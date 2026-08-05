-- Selection decisions retain the candidate/version proof used by the lifecycle
-- service. Existing seed/demo rows receive an explicit empty object.
ALTER TABLE "WeeklyMissionAssignment"
  ADD COLUMN "selectionMetadata" JSONB NOT NULL DEFAULT '{}';

-- A parent snapshot is required so even an empty assignment set is frozen for
-- a participant match. Entries capture the evaluator version independently of
-- later registry releases.
CREATE TABLE "MissionMatchSnapshot" (
  "id" UUID NOT NULL,
  "participantMatchId" UUID NOT NULL,
  "matchStartAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MissionMatchSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MissionMatchSnapshotAssignment" (
  "snapshotId" UUID NOT NULL,
  "assignmentId" UUID NOT NULL,
  "evaluatorVersion" VARCHAR(64) NOT NULL,
  CONSTRAINT "MissionMatchSnapshotAssignment_pkey"
    PRIMARY KEY ("snapshotId", "assignmentId")
);

CREATE UNIQUE INDEX "MissionMatchSnapshot_participantMatchId_key"
  ON "MissionMatchSnapshot"("participantMatchId");
CREATE INDEX "MissionMatchSnapshot_matchStartAt_idx"
  ON "MissionMatchSnapshot"("matchStartAt");
CREATE INDEX "MissionMatchSnapshotAssignment_assignmentId_idx"
  ON "MissionMatchSnapshotAssignment"("assignmentId");

ALTER TABLE "MissionMatchSnapshot"
  ADD CONSTRAINT "MissionMatchSnapshot_participantMatchId_fkey"
  FOREIGN KEY ("participantMatchId") REFERENCES "ParticipantMatch"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MissionMatchSnapshotAssignment"
  ADD CONSTRAINT "MissionMatchSnapshotAssignment_snapshotId_fkey"
  FOREIGN KEY ("snapshotId") REFERENCES "MissionMatchSnapshot"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionMatchSnapshotAssignment"
  ADD CONSTRAINT "MissionMatchSnapshotAssignment_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "WeeklyMissionAssignment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "assert_mission_snapshot_scope"() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "MissionMatchSnapshot" snapshot
    JOIN "ParticipantMatch" participant_match
      ON participant_match."id" = snapshot."participantMatchId"
    JOIN "WeeklyMissionAssignment" assignment
      ON assignment."id" = NEW."assignmentId"
    WHERE snapshot."id" = NEW."snapshotId"
      AND participant_match."participantWeekId" = assignment."participantWeekId"
      AND assignment."activeFrom" <= snapshot."matchStartAt"
      AND (
        assignment."activeTo" IS NULL
        OR snapshot."matchStartAt" < assignment."activeTo"
      )
  ) THEN
    RAISE EXCEPTION 'Mission snapshot assignment is outside the participant week or active interval'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MissionMatchSnapshotAssignment_scope_consistency"
  BEFORE INSERT OR UPDATE ON "MissionMatchSnapshotAssignment"
  FOR EACH ROW EXECUTE FUNCTION "assert_mission_snapshot_scope"();

CREATE TRIGGER "MissionMatchSnapshot_immutable"
  BEFORE UPDATE OR DELETE ON "MissionMatchSnapshot"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();

CREATE TRIGGER "MissionMatchSnapshotAssignment_immutable"
  BEFORE UPDATE OR DELETE ON "MissionMatchSnapshotAssignment"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
