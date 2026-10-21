export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const timeFmt = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
const dateFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" });
const dateLongFmt = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });
const weekdayFmt = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric" });

export const fmtTime = (ts: number) => timeFmt.format(ts);
export const fmtDate = (ts: number) => dateFmt.format(ts).replace(".", "");
export const fmtDateLong = (ts: number) => dateLongFmt.format(ts).replace(".", "");
export const fmtWeekday = (ts: number) => weekdayFmt.format(ts).replace(".", "");

export function fmtDateTime(ts: number, now: number): string {
  if (startOfDay(ts) === startOfDay(now)) return `Hoy ${fmtTime(ts)}`;
  if (startOfDay(ts) === startOfDay(now - DAY)) return `Ayer ${fmtTime(ts)}`;
  return `${fmtDate(ts)} ${fmtTime(ts)}`;
}

export function fmtAgo(ts: number, now: number): string {
  const diff = now - ts;
  const future = diff < 0;
  const m = Math.round(Math.abs(diff) / MIN);
  let s: string;
  if (m < 1) s = "ahora";
  else if (m < 60) s = `${m} min`;
  else if (m < 48 * 60) s = `${Math.floor(m / 60)} h${m % 60 && m < 600 ? ` ${m % 60} min` : ""}`;
  else s = `${Math.floor(m / 1440)} d`;
  if (s === "ahora") return s;
  return future ? `en ${s}` : `hace ${s}`;
}

/** Horas con un decimal, p. ej. "6.5 h". */
export function fmtHours(ms: number): string {
  const h = ms / HOUR;
  if (h >= 100) return `${Math.round(h)} h`;
  return `${h.toFixed(1)} h`;
}

export function toDateInput(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateInput(v: string): number {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, m - 1, d).getTime();
}
