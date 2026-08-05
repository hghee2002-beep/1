const INTERNAL_BASE_URL = "https://internal.invalid";

export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback = "/me",
) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/u.test(candidate)) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, INTERNAL_BASE_URL);
    if (parsed.origin !== INTERNAL_BASE_URL) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function isSameOrigin(origin: string | null, applicationUrl: string) {
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(applicationUrl).origin;
  } catch {
    return false;
  }
}
