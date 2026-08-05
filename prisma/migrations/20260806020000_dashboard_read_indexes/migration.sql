-- Public match feeds filter eligible participant matches inside one week before
-- joining normalized match metadata. Keep this query bounded without indexing
-- any raw Riot payload fields.
CREATE INDEX "ParticipantMatch_participantWeekId_eligible_seasonMatchId_idx"
ON "ParticipantMatch"("participantWeekId", "eligible", "seasonMatchId");
