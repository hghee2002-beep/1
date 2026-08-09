-- PUUID is the canonical participant identity. Summoner-V4 may omit the
-- legacy encrypted summoner ID, so participation must not depend on it.
ALTER TABLE "Participant"
  ALTER COLUMN "summonerId" DROP NOT NULL;
