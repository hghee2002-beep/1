const FORMULA_PREFIX = /^(?:[\t\r\n]|[\s\uFEFF]*[=+\-@])/u;

export function sanitizeExportCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function encodeCsv(rows: readonly (readonly unknown[])[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const safe = sanitizeExportCell(cell);
          return /[",\r\n]/u.test(safe)
            ? `"${safe.replaceAll('"', '""')}"`
            : safe;
        })
        .join(","),
    )
    .join("\r\n");
}

export function exportFileName(input: {
  type: string;
  format: "CSV" | "JSON";
  createdAt: Date;
}) {
  const date = input.createdAt.toISOString().slice(0, 10);
  return `deluxe-soloq-${input.type.toLowerCase()}-${date}.${input.format.toLowerCase()}`;
}
