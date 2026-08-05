const KST_TIME_ZONE = "Asia/Seoul";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: KST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: KST_TIME_ZONE,
  dateStyle: "medium",
  timeStyle: "short",
});

export function kstDateKey(date: Date) {
  const parts = dateKeyFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function kstDateStart(dateOrKey: Date | string) {
  const key = typeof dateOrKey === "string" ? dateOrKey : kstDateKey(dateOrKey);
  return new Date(`${key}T00:00:00+09:00`);
}

export function shiftDateKey(key: string, days: number) {
  const shifted = new Date(kstDateStart(key).getTime() + days * 86_400_000);
  return kstDateKey(shifted);
}

export function formatKstDateTime(date: Date) {
  return `${dateTimeFormatter.format(date)} KST`;
}

export function formatRelativeKorean(date: Date, now: Date) {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 1_000),
  );
  if (seconds < 60) return "방금 전";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function countdownParts(endAt: Date, now: Date) {
  const remaining = Math.max(0, endAt.getTime() - now.getTime());
  const totalMinutes = Math.floor(remaining / 60_000);
  return {
    days: String(Math.floor(totalMinutes / 1_440)).padStart(2, "0"),
    hours: String(Math.floor((totalMinutes % 1_440) / 60)).padStart(2, "0"),
    minutes: String(totalMinutes % 60).padStart(2, "0"),
  };
}
