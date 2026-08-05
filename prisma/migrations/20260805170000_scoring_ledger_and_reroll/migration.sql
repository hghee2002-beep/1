-- Commitment and RNG versions evolve independently. Persist both so historical
-- reveals remain verifiable after a future canonical encoding change.
ALTER TABLE "PointDraw"
  ADD COLUMN "firstCommitmentVersion" VARCHAR(32) NOT NULL DEFAULT 'v1',
  ADD COLUMN "secondCommitmentVersion" VARCHAR(32),
  ADD COLUMN "rerollEntitlementKey" VARCHAR(192),
  ADD COLUMN "rerollEntitlementSource" VARCHAR(32),
  ADD COLUMN "rerollGrantedAt" TIMESTAMP(3),
  ADD COLUMN "rerollExpiresAt" TIMESTAMP(3),
  ADD COLUMN "rerollDemoOnly" BOOLEAN NOT NULL DEFAULT false;

UPDATE "PointDraw"
SET "secondCommitmentVersion" = 'v1'
WHERE "secondValue" IS NOT NULL;

-- Backfill any pre-session entitlement with its owning week deadline. Existing
-- development rows used DEMO_ONLY_MVP_ACE; unknown legacy reasons stay LEGACY.
UPDATE "PointDraw" draw
SET
  "rerollEntitlementKey" = 'legacy:point-draw:' || draw."id",
  "rerollEntitlementSource" = CASE
    WHEN draw."rerollReason" LIKE 'DEMO_ONLY%' THEN 'DEMO_ONLY'
    ELSE 'LEGACY'
  END,
  "rerollGrantedAt" = draw."firstGeneratedAt",
  "rerollExpiresAt" = week."endAt",
  "rerollDemoOnly" = draw."rerollReason" LIKE 'DEMO_ONLY%'
FROM "ParticipantMatch" participant_match
JOIN "ParticipantWeek" participant_week
  ON participant_week."id" = participant_match."participantWeekId"
JOIN "Week" week ON week."id" = participant_week."weekId"
WHERE draw."participantMatchId" = participant_match."id"
  AND draw."rerollEligible" = true;

ALTER TABLE "PointDraw"
  DROP CONSTRAINT "PointDraw_second_result_coherence_check",
  ADD CONSTRAINT "PointDraw_first_commitment_version_check"
    CHECK (length("firstCommitmentVersion") > 0),
  ADD CONSTRAINT "PointDraw_reroll_entitlement_check"
  CHECK (
    NOT "rerollEligible"
    OR (
      "rerollEntitlementKey" IS NOT NULL
      AND "rerollEntitlementSource" IS NOT NULL
      AND "rerollGrantedAt" IS NOT NULL
      AND "rerollExpiresAt" IS NOT NULL
      AND "rerollReason" IS NOT NULL
      AND "rerollGrantedAt" < "rerollExpiresAt"
    )
  ),
  ADD CONSTRAINT "PointDraw_second_result_coherence_check"
  CHECK (
    (
      "secondValue" IS NULL
      AND "secondNonceEncryptedOrProtected" IS NULL
      AND "secondCommitment" IS NULL
      AND "secondCommitmentVersion" IS NULL
      AND "secondRngVersion" IS NULL
      AND "rerollUsedAt" IS NULL
    )
    OR
    (
      "secondValue" IS NOT NULL
      AND "secondNonceEncryptedOrProtected" IS NOT NULL
      AND "secondCommitment" IS NOT NULL
      AND "secondCommitmentVersion" IS NOT NULL
      AND length("secondCommitmentVersion") > 0
      AND "secondRngVersion" IS NOT NULL
      AND "rerollUsedAt" IS NOT NULL
    )
  );

CREATE UNIQUE INDEX "PointDraw_rerollEntitlementKey_key"
  ON "PointDraw" ("rerollEntitlementKey");

-- The application uses deterministic idempotency keys, while these partial
-- unique indexes independently guarantee that a match can have only one
-- initial settlement and one reroll adjustment.
CREATE UNIQUE INDEX "ScoreLedger_one_match_initial"
  ON "ScoreLedger" ("participantMatchId")
  WHERE "type" = 'MATCH_INITIAL';

CREATE UNIQUE INDEX "ScoreLedger_one_match_reroll_adjustment"
  ON "ScoreLedger" ("participantMatchId")
  WHERE "type" = 'MATCH_REROLL_ADJUSTMENT';
