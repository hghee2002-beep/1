CREATE TYPE "RankSnapshotStatus" AS ENUM (
  'CAPTURED',
  'UNRANKED',
  'UNCHANGED',
  'API_ERROR'
);

ALTER TABLE "RankSnapshot"
ADD COLUMN "status" "RankSnapshotStatus" NOT NULL DEFAULT 'CAPTURED',
ADD COLUMN "errorCode" VARCHAR(64);

ALTER TABLE "SyncCursor"
ADD COLUMN "seasonId" UUID,
ADD COLUMN "paginationStart" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "paginationWindowStartAt" TIMESTAMP(3),
ADD COLUMN "paginationWindowEndAt" TIMESTAMP(3);

CREATE INDEX "SyncCursor_seasonId_paginationStart_idx"
ON "SyncCursor"("seasonId", "paginationStart");

ALTER TABLE "SyncCursor"
ADD CONSTRAINT "SyncCursor_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SyncCursor"
ADD CONSTRAINT "SyncCursor_pagination_state_check" CHECK (
  "paginationStart" >= 0
  AND (
    ("paginationStart" = 0)
    OR (
      "paginationWindowStartAt" IS NOT NULL
      AND "paginationWindowEndAt" IS NOT NULL
      AND "paginationWindowStartAt" < "paginationWindowEndAt"
    )
  )
);

DROP INDEX "ParticipantMatch_matchParticipantRawId_key";
CREATE INDEX "ParticipantMatch_matchParticipantRawId_idx"
ON "ParticipantMatch"("matchParticipantRawId");
