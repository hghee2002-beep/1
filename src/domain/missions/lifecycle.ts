const MINUTE_MS = 60_000;

export const MISSION_REFILL_INTERVAL_MINUTES = 360;
export const MISSION_REFILL_MAX_CREDITS = 3;
export const MISSION_REROLL_COOLDOWN_MINUTES = 60;

export type MissionRefillAccrual = {
  credits: number;
  accrued: number;
  accountedThroughAt: Date;
  nextAccrualAt: Date;
};

export function calculateMissionRefillAccrual(input: {
  anchorAt: Date;
  accountedThroughAt: Date;
  now: Date;
  credits: number;
  maxCredits?: number;
  intervalMinutes?: number;
}): MissionRefillAccrual {
  const maxCredits = input.maxCredits ?? MISSION_REFILL_MAX_CREDITS;
  const intervalMinutes =
    input.intervalMinutes ?? MISSION_REFILL_INTERVAL_MINUTES;
  if (!Number.isInteger(maxCredits) || maxCredits < 0) {
    throw new RangeError("Mission refill max credits must be non-negative.");
  }
  if (!Number.isInteger(intervalMinutes) || intervalMinutes <= 0) {
    throw new RangeError("Mission refill interval must be positive.");
  }
  if (!Number.isInteger(input.credits) || input.credits < 0) {
    throw new RangeError("Mission refill credits must be non-negative.");
  }

  const intervalMs = intervalMinutes * MINUTE_MS;
  const anchorMs = input.anchorAt.getTime();
  const nowMs = Math.max(anchorMs, input.now.getTime());
  const accountedMs = Math.max(anchorMs, input.accountedThroughAt.getTime());
  const elapsedTicks = Math.floor((nowMs - anchorMs) / intervalMs);
  const accountedTicks = Math.floor((accountedMs - anchorMs) / intervalMs);
  const accrued = Math.max(0, elapsedTicks - accountedTicks);
  const processedTicks = Math.max(elapsedTicks, accountedTicks);

  return {
    credits: Math.min(maxCredits, input.credits + accrued),
    accrued,
    accountedThroughAt: new Date(anchorMs + processedTicks * intervalMs),
    nextAccrualAt: new Date(anchorMs + (processedTicks + 1) * intervalMs),
  };
}

export function missionRerollNextAvailableAt(
  usedAt: Date,
  cooldownMinutes = MISSION_REROLL_COOLDOWN_MINUTES,
) {
  if (!Number.isInteger(cooldownMinutes) || cooldownMinutes <= 0) {
    throw new RangeError("Mission reroll cooldown must be positive.");
  }
  return new Date(usedAt.getTime() + cooldownMinutes * MINUTE_MS);
}

export function isMissionActiveAt(input: {
  activeFrom: Date;
  activeTo: Date | null;
  at: Date;
}) {
  return (
    input.activeFrom.getTime() <= input.at.getTime() &&
    (input.activeTo === null || input.at.getTime() < input.activeTo.getTime())
  );
}
