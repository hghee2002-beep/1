import "server-only";

type LogLevel = "info" | "warn" | "error";
type LogFields = Readonly<Record<string, unknown>>;

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY =
  /authorization|cookie|secret|token|password|nonce|api[-_]?key|puuid|real[-_]?name|game[-_]?name|tag[-_]?line|riot[-_]?id|email|query|payload/iu;

function redactString(value: string) {
  if (/bearer\s+[a-z0-9._~+/=-]+/iu.test(value)) return REDACTED;
  return value;
}

export function redactLogValue(
  value: unknown,
  key = "",
  seen = new WeakSet<object>(),
): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, "", seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([entryKey, entryValue]) => [
      entryKey,
      redactLogValue(entryValue, entryKey, seen),
    ]),
  );
}

export function createLogRecord(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
  now = new Date(),
) {
  return redactLogValue({
    timestamp: now.toISOString(),
    level,
    event,
    ...fields,
  }) as Record<string, unknown>;
}

function write(level: LogLevel, event: string, fields?: LogFields) {
  const serialized = JSON.stringify(createLogRecord(level, event, fields));
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.info(serialized);
}

export function logInfo(event: string, fields?: LogFields) {
  write("info", event, fields);
}

export function logWarn(event: string, fields?: LogFields) {
  write("warn", event, fields);
}

export function logError(event: string, fields?: LogFields) {
  write("error", event, fields);
}
