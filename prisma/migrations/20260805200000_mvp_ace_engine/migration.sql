CREATE TYPE "MvpEvaluationStatus" AS ENUM (
  'COMPLETED',
  'PENDING_BASELINE',
  'PENDING_DATA',
  'INVALID_MATCH'
);

ALTER TABLE "MatchParticipantRaw"
  ADD COLUMN "startingTier" VARCHAR(32),
  ADD COLUMN "tierBucket" "TierBucket";

ALTER TABLE "MvpBaselineVersion"
  ADD COLUMN "validationReport" JSONB;

ALTER TABLE "MvpEvaluation"
  ADD COLUMN "evaluationKey" VARCHAR(192),
  ADD COLUMN "seasonMatchId" UUID,
  ADD COLUMN "status" "MvpEvaluationStatus",
  ADD COLUMN "errorCode" VARCHAR(64),
  ADD COLUMN "supersedesEvaluationId" UUID;

UPDATE "MvpEvaluation" AS evaluation
SET
  "evaluationKey" = 'legacy:' || evaluation."id"::text,
  "status" = 'COMPLETED',
  "seasonMatchId" = participant_match."seasonMatchId"
FROM "ParticipantMatch" AS participant_match
WHERE participant_match."id" = evaluation."participantMatchId";

UPDATE "MvpEvaluation" AS evaluation
SET "seasonMatchId" = candidate."seasonMatchId"
FROM (
  SELECT DISTINCT ON (raw."id")
    raw."id" AS "rawId",
    season_match."id" AS "seasonMatchId"
  FROM "MatchParticipantRaw" AS raw
  JOIN "SeasonMatch" AS season_match ON season_match."matchId" = raw."matchId"
  ORDER BY raw."id", season_match."createdAt" ASC, season_match."id" ASC
) AS candidate
WHERE evaluation."matchParticipantRawId" = candidate."rawId"
  AND evaluation."seasonMatchId" IS NULL;

ALTER TABLE "MvpEvaluation"
  ALTER COLUMN "evaluationKey" SET NOT NULL,
  ALTER COLUMN "seasonMatchId" SET NOT NULL,
  ALTER COLUMN "status" SET NOT NULL,
  ALTER COLUMN "baselineVersionId" DROP NOT NULL,
  ALTER COLUMN "tierBucket" DROP NOT NULL,
  ALTER COLUMN "position" DROP NOT NULL,
  ALTER COLUMN "visionObjectiveScore" DROP NOT NULL,
  ALTER COLUMN "growthScore" DROP NOT NULL,
  ALTER COLUMN "damageScore" DROP NOT NULL,
  ALTER COLUMN "kdaParticipationScore" DROP NOT NULL,
  ALTER COLUMN "totalScore" DROP NOT NULL,
  ALTER COLUMN "teamRank" DROP NOT NULL;

DROP INDEX "MvpEvaluation_matchParticipantRawId_baselineVersionId_key";

CREATE UNIQUE INDEX "MvpEvaluation_evaluationKey_key"
  ON "MvpEvaluation"("evaluationKey");
CREATE INDEX "MvpEvaluation_seasonMatchId_matchParticipantRawId_evaluatorVersion_idx"
  ON "MvpEvaluation"("seasonMatchId", "matchParticipantRawId", "evaluatorVersion");
CREATE INDEX "MvpEvaluation_seasonMatchId_status_idx"
  ON "MvpEvaluation"("seasonMatchId", "status");
CREATE INDEX "MvpEvaluation_baselineVersionId_evaluatorVersion_idx"
  ON "MvpEvaluation"("baselineVersionId", "evaluatorVersion");
CREATE UNIQUE INDEX "MvpBaselineVersion_single_published_idx"
  ON "MvpBaselineVersion"("status")
  WHERE "status" = 'PUBLISHED';

ALTER TABLE "MvpEvaluation"
  ADD CONSTRAINT "MvpEvaluation_seasonMatchId_fkey"
    FOREIGN KEY ("seasonMatchId") REFERENCES "SeasonMatch"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "MvpEvaluation_supersedesEvaluationId_fkey"
    FOREIGN KEY ("supersedesEvaluationId") REFERENCES "MvpEvaluation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MvpBaselineMetric"
  ADD CONSTRAINT "MvpBaselineMetric_stdDev_positive_check" CHECK ("stdDev" > 0),
  ADD CONSTRAINT "MvpBaselineMetric_sampleSize_nonnegative_check" CHECK ("sampleSize" >= 0);

CREATE FUNCTION "prevent_published_mvp_baseline_content_mutation"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" IN ('PUBLISHED', 'RETIRED') THEN
      RAISE EXCEPTION 'published MVP baseline is immutable; retain the historical version'
        USING ERRCODE = 'P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF OLD."status" = 'PUBLISHED' AND NEW."status" NOT IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'published MVP baseline can only be retired'
      USING ERRCODE = 'P0001';
  END IF;
  IF OLD."status" = 'RETIRED' AND NEW."status" <> 'RETIRED' THEN
    RAISE EXCEPTION 'retired MVP baseline status is immutable'
      USING ERRCODE = 'P0001';
  END IF;
  IF OLD."status" IN ('PUBLISHED', 'RETIRED') AND (
    NEW."name" IS DISTINCT FROM OLD."name" OR
    NEW."sourceDescription" IS DISTINCT FROM OLD."sourceDescription" OR
    NEW."patchFrom" IS DISTINCT FROM OLD."patchFrom" OR
    NEW."patchTo" IS DISTINCT FROM OLD."patchTo" OR
    NEW."collectedAt" IS DISTINCT FROM OLD."collectedAt" OR
    NEW."sampleNotes" IS DISTINCT FROM OLD."sampleNotes" OR
    NEW."demoOnly" IS DISTINCT FROM OLD."demoOnly" OR
    NEW."checksum" IS DISTINCT FROM OLD."checksum" OR
    NEW."validationReport" IS DISTINCT FROM OLD."validationReport" OR
    NEW."uploadedById" IS DISTINCT FROM OLD."uploadedById" OR
    NEW."publishedAt" IS DISTINCT FROM OLD."publishedAt"
  ) THEN
    RAISE EXCEPTION 'published MVP baseline content is immutable; publish a new version instead'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MvpBaselineVersion_published_content_immutable"
  BEFORE UPDATE OR DELETE ON "MvpBaselineVersion"
  FOR EACH ROW EXECUTE FUNCTION "prevent_published_mvp_baseline_content_mutation"();

CREATE FUNCTION "prevent_published_mvp_metric_mutation"() RETURNS trigger AS $$
DECLARE baseline_status "BaselineStatus";
BEGIN
  SELECT "status" INTO baseline_status
  FROM "MvpBaselineVersion"
  WHERE "id" = OLD."versionId";
  IF baseline_status IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION 'published MVP baseline metrics are immutable; publish a new version instead'
      USING ERRCODE = 'P0001';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "MvpBaselineMetric_published_immutable"
  BEFORE UPDATE OR DELETE ON "MvpBaselineMetric"
  FOR EACH ROW EXECUTE FUNCTION "prevent_published_mvp_metric_mutation"();

CREATE TRIGGER "MvpEvaluation_append_only"
  BEFORE UPDATE OR DELETE ON "MvpEvaluation"
  FOR EACH ROW EXECUTE FUNCTION "prevent_append_only_mutation"();
