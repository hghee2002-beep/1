-- Keep optional application preferences with the review record that produced
-- the participant profile.
ALTER TABLE "ParticipationApplication"
ADD COLUMN "primaryPosition" "Position",
ADD COLUMN "secondaryPosition" "Position";

CREATE INDEX "ParticipationApplication_puuid_status_idx"
ON "ParticipationApplication"("puuid", "status");
