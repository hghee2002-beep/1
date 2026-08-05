export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await Promise.all([import("@/lib/env/server"), import("@/lib/env/public")]);
  }
}
