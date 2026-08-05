-- This forward-only hardening migration intentionally leaves every previously
-- checksummed migration untouched.

-- A COMPLETION must identify the one assignment whose unique constraint makes
-- the award single-use. CORRECTION/ADMIN_ADJUSTMENT rows remain nullable.
DO $$
DECLARE invalid_completions bigint;
BEGIN
  SELECT COUNT(*) INTO invalid_completions
  FROM "MissionCompletionLedger"
  WHERE "type" = 'COMPLETION' AND "assignmentId" IS NULL;

  IF invalid_completions > 0 THEN
    RAISE EXCEPTION
      'preflight failed: % COMPLETION mission ledger rows have no assignmentId',
      invalid_completions
      USING ERRCODE = '23514';
  END IF;
END;
$$;

ALTER TABLE "MissionCompletionLedger"
  ADD CONSTRAINT "MissionCompletionLedger_completion_assignment_required_check"
  CHECK ("type" <> 'COMPLETION' OR "assignmentId" IS NOT NULL);

-- Snapshot children may only be collected before the parent is sealed. Legacy
-- snapshots are sealed in place before the new triggers become active.
ALTER TABLE "MissionMatchSnapshot"
  ADD COLUMN "sealedAt" TIMESTAMP(3);

-- The legacy trigger rejects every UPDATE, so replace it only after the
-- one-time backfill has run inside this migration transaction.
DROP TRIGGER "MissionMatchSnapshot_immutable" ON "MissionMatchSnapshot";

UPDATE "MissionMatchSnapshot"
SET "sealedAt" = "createdAt"
WHERE "sealedAt" IS NULL;

CREATE FUNCTION "assert_mission_snapshot_parent_scope"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ParticipantMatch" participant_match
    JOIN "SeasonMatch" season_match
      ON season_match."id" = participant_match."seasonMatchId"
    JOIN "Match" match_row ON match_row."id" = season_match."matchId"
    WHERE participant_match."id" = NEW."participantMatchId"
      AND match_row."gameStartAt" = NEW."matchStartAt"
  ) THEN
    RAISE EXCEPTION
      'mission snapshot matchStartAt must equal the authoritative match start'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MissionMatchSnapshot_parent_scope_consistency"
  BEFORE INSERT OR UPDATE ON "MissionMatchSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "assert_mission_snapshot_parent_scope"();

CREATE OR REPLACE FUNCTION "assert_mission_snapshot_scope"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "MissionMatchSnapshot" snapshot
    JOIN "ParticipantMatch" participant_match
      ON participant_match."id" = snapshot."participantMatchId"
    JOIN "WeeklyMissionAssignment" assignment
      ON assignment."id" = NEW."assignmentId"
    WHERE snapshot."id" = NEW."snapshotId"
      AND snapshot."sealedAt" IS NULL
      AND participant_match."participantWeekId" = assignment."participantWeekId"
      AND assignment."activeFrom" <= snapshot."matchStartAt"
      AND (
        assignment."activeTo" IS NULL
        OR snapshot."matchStartAt" < assignment."activeTo"
      )
      AND NEW."evaluatorVersion" = assignment."evaluatorVersion"
  ) THEN
    RAISE EXCEPTION
      'mission snapshot is sealed or assignment scope/version is invalid'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "prevent_mission_snapshot_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."sealedAt" IS NULL
    AND NEW."sealedAt" IS NOT NULL
    AND NEW."id" = OLD."id"
    AND NEW."participantMatchId" = OLD."participantMatchId"
    AND NEW."matchStartAt" = OLD."matchStartAt"
    AND NEW."createdAt" = OLD."createdAt"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'MissionMatchSnapshot is immutable after its one-way seal'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MissionMatchSnapshot_immutable"
  BEFORE UPDATE OR DELETE ON "MissionMatchSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "prevent_mission_snapshot_mutation"();

-- A normal evaluation must refer to the sealed game-start snapshot and exact
-- evaluator version. Admin correction events instead prove scope through the
-- immutable source event they supersede.
CREATE OR REPLACE FUNCTION "assert_mission_event_scope"() RETURNS trigger AS $$
BEGIN
  IF NEW."type" = 'NORMAL' AND NOT EXISTS (
    SELECT 1
    FROM "WeeklyMissionAssignment" assignment
    JOIN "ParticipantMatch" participant_match
      ON participant_match."participantWeekId" = assignment."participantWeekId"
    JOIN "MissionMatchSnapshot" snapshot
      ON snapshot."participantMatchId" = participant_match."id"
    JOIN "MissionMatchSnapshotAssignment" snapshot_assignment
      ON snapshot_assignment."snapshotId" = snapshot."id"
      AND snapshot_assignment."assignmentId" = assignment."id"
      AND snapshot_assignment."evaluatorVersion" = NEW."evaluatorVersion"
    WHERE assignment."id" = NEW."assignmentId"
      AND participant_match."id" = NEW."participantMatchId"
      AND snapshot."sealedAt" IS NOT NULL
  ) THEN
    RAISE EXCEPTION
      'normal mission event requires sealed snapshot membership and evaluator version'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."type" = 'CORRECTION' AND NOT EXISTS (
    SELECT 1
    FROM "MissionProgressEvent" source_event
    WHERE source_event."id" = NEW."supersedesEventId"
      AND source_event."assignmentId" = NEW."assignmentId"
      AND source_event."participantMatchId" = NEW."participantMatchId"
  ) THEN
    RAISE EXCEPTION
      'mission correction must supersede an event in the same assignment and match scope'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Closed competition scopes are a write fence. Delayed workers remain allowed
-- while status is ACTIVE, even after the wall-clock week end, until finalize.
CREATE FUNCTION "assert_participant_week_competition_open"(target_id UUID)
RETURNS void AS $$
DECLARE
  week_status "WeekStatus";
  season_status "SeasonStatus";
BEGIN
  SELECT week."status", season."status"
    INTO week_status, season_status
  FROM "ParticipantWeek" participant_week
  JOIN "Week" week ON week."id" = participant_week."weekId"
  JOIN "Season" season ON season."id" = week."seasonId"
  WHERE participant_week."id" = target_id
  FOR SHARE OF season;

  IF week_status IS NULL OR season_status IS NULL THEN
    RAISE EXCEPTION 'participant week competition scope not found'
      USING ERRCODE = '23503';
  END IF;

  IF week_status IN ('FINALIZING', 'COMPLETED')
    OR season_status IN ('FINALIZING', 'COMPLETED', 'ARCHIVED')
  THEN
    RAISE EXCEPTION 'competition scope is finalized; writes are closed'
      USING ERRCODE = '55000';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Every writer that attaches competition data takes a shared lock on the
-- owning season. Season finalization takes the conflicting exclusive lock,
-- so a stale sync transaction cannot commit after the final snapshot.
CREATE OR REPLACE FUNCTION "assert_season_match_week"() RETURNS trigger AS $$
DECLARE
  week_status "WeekStatus";
  season_status "SeasonStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT week."status", season."status"
      INTO week_status, season_status
    FROM "Week" week
    JOIN "Season" season ON season."id" = week."seasonId"
    WHERE week."id" = OLD."weekId"
      AND week."seasonId" = OLD."seasonId"
    FOR SHARE OF season;

    IF week_status IN ('FINALIZING', 'COMPLETED')
      OR season_status IN ('FINALIZING', 'COMPLETED', 'ARCHIVED')
    THEN
      RAISE EXCEPTION 'competition scope is finalized; SeasonMatch writes are closed'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW."seasonId" IS DISTINCT FROM OLD."seasonId"
    OR NEW."weekId" IS DISTINCT FROM OLD."weekId"
    OR NEW."matchId" IS DISTINCT FROM OLD."matchId"
  ) THEN
    RAISE EXCEPTION 'SeasonMatch competition identity is immutable'
      USING ERRCODE = '55000';
  END IF;

  SELECT week."status", season."status"
    INTO week_status, season_status
  FROM "Week" week
  JOIN "Season" season ON season."id" = week."seasonId"
  WHERE week."id" = NEW."weekId"
    AND week."seasonId" = NEW."seasonId"
  FOR SHARE OF season;

  IF week_status IS NULL OR season_status IS NULL THEN
    RAISE EXCEPTION 'SeasonMatch week must belong to its season'
      USING ERRCODE = '23514';
  END IF;
  IF week_status IN ('FINALIZING', 'COMPLETED')
    OR season_status IN ('FINALIZING', 'COMPLETED', 'ARCHIVED')
  THEN
    RAISE EXCEPTION 'competition scope is finalized; SeasonMatch writes are closed'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "SeasonMatch_week_consistency" ON "SeasonMatch";
CREATE TRIGGER "SeasonMatch_week_consistency"
  BEFORE INSERT OR UPDATE OR DELETE ON "SeasonMatch"
  FOR EACH ROW EXECUTE FUNCTION "assert_season_match_week"();

CREATE OR REPLACE FUNCTION "assert_participant_match_scope"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM "assert_participant_week_competition_open"(OLD."participantWeekId");
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW."participantId" IS DISTINCT FROM OLD."participantId"
    OR NEW."participantWeekId" IS DISTINCT FROM OLD."participantWeekId"
    OR NEW."seasonMatchId" IS DISTINCT FROM OLD."seasonMatchId"
    OR NEW."matchParticipantRawId" IS DISTINCT FROM OLD."matchParticipantRawId"
  ) THEN
    RAISE EXCEPTION 'ParticipantMatch competition identity is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "ParticipantWeek" participant_week
    JOIN "SeasonMatch" season_match
      ON season_match."weekId" = participant_week."weekId"
    JOIN "MatchParticipantRaw" raw_participant
      ON raw_participant."id" = NEW."matchParticipantRawId"
      AND raw_participant."matchId" = season_match."matchId"
    WHERE participant_week."id" = NEW."participantWeekId"
      AND participant_week."participantId" = NEW."participantId"
      AND season_match."id" = NEW."seasonMatchId"
  ) THEN
    RAISE EXCEPTION 'ParticipantMatch participant/week/season match scope mismatch'
      USING ERRCODE = '23514';
  END IF;

  PERFORM "assert_participant_week_competition_open"(NEW."participantWeekId");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "ParticipantMatch_scope_consistency" ON "ParticipantMatch";
CREATE TRIGGER "ParticipantMatch_scope_consistency"
  BEFORE INSERT OR UPDATE OR DELETE ON "ParticipantMatch"
  FOR EACH ROW EXECUTE FUNCTION "assert_participant_match_scope"();

CREATE FUNCTION "assert_point_draw_write_open"() RETURNS trigger AS $$
DECLARE target_participant_week_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."participantMatchId" IS DISTINCT FROM OLD."participantMatchId"
    OR NEW."resultSign" IS DISTINCT FROM OLD."resultSign"
    OR NEW."firstValue" IS DISTINCT FROM OLD."firstValue"
    OR NEW."firstNonceEncryptedOrProtected" IS DISTINCT FROM OLD."firstNonceEncryptedOrProtected"
    OR NEW."firstCommitment" IS DISTINCT FROM OLD."firstCommitment"
    OR NEW."firstCommitmentVersion" IS DISTINCT FROM OLD."firstCommitmentVersion"
    OR NEW."firstRngVersion" IS DISTINCT FROM OLD."firstRngVersion"
    OR NEW."firstGeneratedAt" IS DISTINCT FROM OLD."firstGeneratedAt"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
  ) THEN
    RAISE EXCEPTION 'PointDraw initial sealed evidence is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."secondValue" IS NOT NULL AND (
    NEW."secondValue" IS DISTINCT FROM OLD."secondValue"
    OR NEW."secondNonceEncryptedOrProtected" IS DISTINCT FROM OLD."secondNonceEncryptedOrProtected"
    OR NEW."secondCommitment" IS DISTINCT FROM OLD."secondCommitment"
    OR NEW."secondCommitmentVersion" IS DISTINCT FROM OLD."secondCommitmentVersion"
    OR NEW."secondRngVersion" IS DISTINCT FROM OLD."secondRngVersion"
    OR NEW."rerollUsedAt" IS DISTINCT FROM OLD."rerollUsedAt"
    OR NEW."finalValue" IS DISTINCT FROM OLD."finalValue"
    OR NEW."finalSignedValue" IS DISTINCT FROM OLD."finalSignedValue"
  ) THEN
    RAISE EXCEPTION 'PointDraw final reroll evidence is immutable'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."secondValue" IS NULL THEN
    IF NEW."secondValue" IS NULL AND (
      NEW."finalValue" IS DISTINCT FROM OLD."finalValue"
      OR NEW."finalSignedValue" IS DISTINCT FROM OLD."finalSignedValue"
    ) THEN
      RAISE EXCEPTION 'PointDraw final value may change only during reroll'
        USING ERRCODE = '55000';
    END IF;
    IF NEW."secondValue" IS NOT NULL AND (
      NEW."state" <> 'REROLLED'
      OR NEW."secondNonceEncryptedOrProtected" IS NULL
      OR NEW."secondCommitment" IS NULL
      OR NEW."secondCommitmentVersion" IS NULL
      OR NEW."secondRngVersion" IS NULL
      OR NEW."rerollUsedAt" IS NULL
    ) THEN
      RAISE EXCEPTION 'PointDraw reroll evidence must be written atomically'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  SELECT "participantWeekId" INTO target_participant_week_id
  FROM "ParticipantMatch"
  WHERE "id" = CASE WHEN TG_OP = 'DELETE'
    THEN OLD."participantMatchId"
    ELSE NEW."participantMatchId"
  END;

  PERFORM "assert_participant_week_competition_open"(target_participant_week_id);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PointDraw_competition_write_fence"
  BEFORE INSERT OR UPDATE OR DELETE ON "PointDraw"
  FOR EACH ROW EXECUTE FUNCTION "assert_point_draw_write_open"();

ALTER TABLE "PointDraw"
  ADD CONSTRAINT "PointDraw_second_nonce_coherence_check"
  CHECK (
    ("secondValue" IS NULL AND "secondNonceEncryptedOrProtected" IS NULL)
    OR
    ("secondValue" IS NOT NULL AND "secondNonceEncryptedOrProtected" IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION "assert_mission_snapshot_parent_scope"() RETURNS trigger AS $$
DECLARE target_participant_week_id UUID;
BEGIN
  SELECT participant_match."participantWeekId"
    INTO target_participant_week_id
  FROM "ParticipantMatch" participant_match
  JOIN "SeasonMatch" season_match
    ON season_match."id" = participant_match."seasonMatchId"
  JOIN "Match" match_row ON match_row."id" = season_match."matchId"
  WHERE participant_match."id" = NEW."participantMatchId"
    AND match_row."gameStartAt" = NEW."matchStartAt";

  IF target_participant_week_id IS NULL THEN
    RAISE EXCEPTION
      'mission snapshot matchStartAt must equal the authoritative match start'
      USING ERRCODE = '23514';
  END IF;

  PERFORM "assert_participant_week_competition_open"(target_participant_week_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_mission_snapshot_scope"() RETURNS trigger AS $$
DECLARE target_participant_week_id UUID;
BEGIN
  SELECT participant_match."participantWeekId"
    INTO target_participant_week_id
  FROM "MissionMatchSnapshot" snapshot
  JOIN "ParticipantMatch" participant_match
    ON participant_match."id" = snapshot."participantMatchId"
  JOIN "WeeklyMissionAssignment" assignment
    ON assignment."id" = NEW."assignmentId"
  WHERE snapshot."id" = NEW."snapshotId"
    AND snapshot."sealedAt" IS NULL
    AND participant_match."participantWeekId" = assignment."participantWeekId"
    AND assignment."activeFrom" <= snapshot."matchStartAt"
    AND (
      assignment."activeTo" IS NULL
      OR snapshot."matchStartAt" < assignment."activeTo"
    )
    AND NEW."evaluatorVersion" = assignment."evaluatorVersion";

  IF target_participant_week_id IS NULL THEN
    RAISE EXCEPTION
      'mission snapshot is sealed or assignment scope/version is invalid'
      USING ERRCODE = '23514';
  END IF;

  PERFORM "assert_participant_week_competition_open"(target_participant_week_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_mvp_evaluation_write_open"() RETURNS trigger AS $$
DECLARE
  week_status "WeekStatus";
  season_status "SeasonStatus";
BEGIN
  SELECT week."status", season."status"
    INTO week_status, season_status
  FROM "SeasonMatch" season_match
  JOIN "Week" week ON week."id" = season_match."weekId"
  JOIN "Season" season ON season."id" = season_match."seasonId"
  WHERE season_match."id" = NEW."seasonMatchId"
  FOR SHARE OF season;

  IF week_status IS NULL OR season_status IS NULL THEN
    RAISE EXCEPTION 'MVP evaluation competition scope not found'
      USING ERRCODE = '23503';
  END IF;
  IF week_status IN ('FINALIZING', 'COMPLETED')
    OR season_status IN ('FINALIZING', 'COMPLETED', 'ARCHIVED')
  THEN
    RAISE EXCEPTION 'competition scope is finalized; MVP evaluation writes are closed'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "assert_weekly_mission_assignment_write_open"() RETURNS trigger AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM "assert_participant_week_competition_open"(OLD."participantWeekId");
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE')
    AND (TG_OP = 'INSERT' OR NEW."participantWeekId" IS DISTINCT FROM OLD."participantWeekId")
  THEN
    PERFORM "assert_participant_week_competition_open"(NEW."participantWeekId");
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "WeeklyMissionAssignment_competition_write_fence"
  BEFORE INSERT OR UPDATE OR DELETE ON "WeeklyMissionAssignment"
  FOR EACH ROW EXECUTE FUNCTION "assert_weekly_mission_assignment_write_open"();

CREATE FUNCTION "assert_participant_week_row_write_open"() RETURNS trigger AS $$
DECLARE
  week_status "WeekStatus";
  season_status "SeasonStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM "assert_participant_week_competition_open"(OLD."id");
    RETURN OLD;
  END IF;

  SELECT week."status", season."status"
    INTO week_status, season_status
  FROM "Week" week
  JOIN "Season" season ON season."id" = week."seasonId"
  WHERE week."id" = NEW."weekId"
  FOR SHARE OF season;

  IF week_status IS NULL OR season_status IS NULL THEN
    RAISE EXCEPTION 'ParticipantWeek competition scope not found'
      USING ERRCODE = '23503';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM "Week" week
    JOIN "SeasonParticipant" season_participant
      ON season_participant."seasonId" = week."seasonId"
      AND season_participant."participantId" = NEW."participantId"
    WHERE week."id" = NEW."weekId"
  ) THEN
    RAISE EXCEPTION 'ParticipantWeek participant must belong to the season'
      USING ERRCODE = '23514';
  END IF;
  IF week_status IN ('FINALIZING', 'COMPLETED')
    OR season_status IN ('FINALIZING', 'COMPLETED', 'ARCHIVED')
  THEN
    RAISE EXCEPTION 'competition scope is finalized; ParticipantWeek writes are closed'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ParticipantWeek_row_competition_write_fence"
  BEFORE INSERT OR DELETE ON "ParticipantWeek"
  FOR EACH ROW EXECUTE FUNCTION "assert_participant_week_row_write_open"();

CREATE OR REPLACE FUNCTION "assert_score_ledger_scope"() RETURNS trigger AS $$
BEGIN
  PERFORM "assert_participant_week_competition_open"(NEW."participantWeekId");

  IF NEW."participantMatchId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "ParticipantMatch" participant_match
    WHERE participant_match."id" = NEW."participantMatchId"
      AND participant_match."participantWeekId" = NEW."participantWeekId"
  ) THEN
    RAISE EXCEPTION 'ScoreLedger participant week must match ParticipantMatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "assert_mission_completion_scope"() RETURNS trigger AS $$
BEGIN
  PERFORM "assert_participant_week_competition_open"(NEW."participantWeekId");

  IF NEW."assignmentId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "WeeklyMissionAssignment" assignment
    WHERE assignment."id" = NEW."assignmentId"
      AND assignment."participantWeekId" = NEW."participantWeekId"
  ) THEN
    RAISE EXCEPTION 'Mission completion participant week must match assignment'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "assert_mission_progress_event_write_open"() RETURNS trigger AS $$
DECLARE target_participant_week_id UUID;
BEGIN
  SELECT "participantWeekId" INTO target_participant_week_id
  FROM "WeeklyMissionAssignment"
  WHERE "id" = NEW."assignmentId";

  PERFORM "assert_participant_week_competition_open"(target_participant_week_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MissionProgressEvent_competition_write_fence"
  BEFORE INSERT ON "MissionProgressEvent"
  FOR EACH ROW EXECUTE FUNCTION "assert_mission_progress_event_write_open"();

CREATE TRIGGER "MvpEvaluation_competition_write_fence"
  BEFORE INSERT ON "MvpEvaluation"
  FOR EACH ROW EXECUTE FUNCTION "assert_mvp_evaluation_write_open"();

-- Protect every competition-derived ParticipantWeek projection even from a
-- direct write that bypasses the corresponding event/ledger insert. Identity
-- fields are immutable because moving the row would detach its ledgers.
CREATE FUNCTION "assert_participant_week_derived_write_open"() RETURNS trigger AS $$
BEGIN
  IF NEW."weekId" IS DISTINCT FROM OLD."weekId"
    OR NEW."participantId" IS DISTINCT FROM OLD."participantId"
  THEN
    RAISE EXCEPTION 'ParticipantWeek identity is immutable'
      USING ERRCODE = '55000';
  END IF;

  PERFORM "assert_participant_week_competition_open"(OLD."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ParticipantWeek_derived_competition_write_fence"
  BEFORE UPDATE ON "ParticipantWeek"
  FOR EACH ROW EXECUTE FUNCTION "assert_participant_week_derived_write_open"();

-- Published/retired metric sets are immutable for INSERT as well as
-- UPDATE/DELETE, including reassignment from an unprotected version.
CREATE OR REPLACE FUNCTION "prevent_published_mvp_metric_mutation"() RETURNS trigger AS $$
DECLARE
  old_baseline_status "BaselineStatus";
  new_baseline_status "BaselineStatus";
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT "status" INTO old_baseline_status
    FROM "MvpBaselineVersion"
    WHERE "id" = OLD."versionId";
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT "status" INTO new_baseline_status
    FROM "MvpBaselineVersion"
    WHERE "id" = NEW."versionId";
  END IF;

  IF old_baseline_status IN ('PUBLISHED', 'RETIRED')
    OR new_baseline_status IN ('PUBLISHED', 'RETIRED')
  THEN
    RAISE EXCEPTION
      'published MVP baseline metrics are immutable; publish a new version instead'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "MvpBaselineMetric_published_immutable" ON "MvpBaselineMetric";
CREATE TRIGGER "MvpBaselineMetric_published_immutable"
  BEFORE INSERT OR UPDATE OR DELETE ON "MvpBaselineMetric"
  FOR EACH ROW EXECUTE FUNCTION "prevent_published_mvp_metric_mutation"();

-- Once referenced, definition content is a versioned input to deterministic
-- evaluation. Operational activation may change; v1 content may not.
CREATE FUNCTION "prevent_referenced_mission_definition_content_mutation"()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "WeeklyMissionAssignment"
    WHERE "missionDefinitionId" = OLD."id"
  ) AND (
    NEW."code" IS DISTINCT FROM OLD."code"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."title" IS DISTINCT FROM OLD."title"
    OR NEW."description" IS DISTINCT FROM OLD."description"
    OR NEW."category" IS DISTINCT FROM OLD."category"
    OR NEW."kind" IS DISTINCT FROM OLD."kind"
    OR NEW."difficulty" IS DISTINCT FROM OLD."difficulty"
    OR NEW."points" IS DISTINCT FROM OLD."points"
    OR NEW."evaluatorKey" IS DISTINCT FROM OLD."evaluatorKey"
    OR NEW."evaluatorConfig" IS DISTINCT FROM OLD."evaluatorConfig"
    OR NEW."sourceType" IS DISTINCT FROM OLD."sourceType"
    OR NEW."target" IS DISTINCT FROM OLD."target"
    OR NEW."targetText" IS DISTINCT FROM OLD."targetText"
    OR NEW."minPatch" IS DISTINCT FROM OLD."minPatch"
    OR NEW."maxPatch" IS DISTINCT FROM OLD."maxPatch"
  ) THEN
    RAISE EXCEPTION
      'referenced mission definition content is immutable; create a new version'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MissionDefinition_referenced_content_immutable"
  BEFORE UPDATE ON "MissionDefinition"
  FOR EACH ROW EXECUTE FUNCTION "prevent_referenced_mission_definition_content_mutation"();
