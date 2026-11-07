// All platform times are Africa/Kigali (UTC+2, no DST). Dates are stored as plain strings.
const OFFSET_MS = 2 * 3600 * 1000;
export function kigaliNow(base: Date = new Date()): Date {
  return new Date(base.getTime() + OFFSET_MS); // use getUTC* on the result
}
export function pad(n: number) { return String(n).padStart(2, '0'); }
export function fmtDate(d: Date) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
let fixedNow: Date | null = null;
/** Tests may pin "now" for deterministic date logic. */
export function setFixedNow(d: Date | null) { fixedNow = d; }
function current() { return fixedNow ?? new Date(); }
export function todayStr() { return fmtDate(kigaliNow(current())); }
export function nowStr() { const k = kigaliNow(current()); return `${fmtDate(k)}T${pad(k.getUTCHours())}:${pad(k.getUTCMinutes())}`; }
export function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return fmtDate(dt);
}
/** 0=Sunday..6=Saturday */
export function weekday(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
