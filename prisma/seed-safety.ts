export function assertDevelopmentSeedAllowed(nodeEnv: string | undefined) {
  if (nodeEnv === "development" || nodeEnv === "test") return;

  throw new Error(
    "The DEMO_ONLY seed requires explicit NODE_ENV=development or NODE_ENV=test.",
  );
}
