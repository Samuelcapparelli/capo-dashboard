// Hilfsfunktionen: Datum (Europe/Zurich), Formatierung (CH), HTML-Escaping
export const TZ = "Europe/Zurich";
export const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const WD_LONG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const MON = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];
export const MON_LONG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

// Aktuelles Datum/Uhrzeit in Zürich, unabhängig von der Geräte-Zeitzone
export function zurichNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { iso: `${p.year}-${p.month}-${p.day}`, h: +p.hour, m: +p.minute, s: +p.second, minutes: +p.hour * 60 + +p.minute };
}
export const todayISO = () => zurichNow().iso;

export const pd = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
export const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const add = (d, n) => { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; };
export const addISO = (s, n) => iso(add(pd(s), n));
export const monday = d => add(d, -((d.getDay() + 6) % 7));
export const mondayISO = s => iso(monday(pd(s)));
export const diffDays = (a, b) => Math.round((pd(b) - pd(a)) / 86400000); // b - a in Tagen
export const fridayOfWeek = s => addISO(mondayISO(s), 4);

export function isoWeek(s) {
  const d = pd(s), t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / 86400000 + 1) / 7);
}

export const dShort = s => { const d = pd(s); return `${WD[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`; };
export const dMid = s => { const d = pd(s); return `${WD[d.getDay()]} ${d.getDate()}. ${MON[d.getMonth()]}`; };
export const dLong = s => { const d = pd(s); return `${WD_LONG[d.getDay()]}, ${d.getDate()}. ${MON_LONG[d.getMonth()]} ${d.getFullYear()}`; };
export const dFull = s => { const d = pd(s); return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`; };

// «heute», «morgen», «in 5 Tagen», «vor 2 Tagen»
export function rel(s, today = todayISO()) {
  const n = diffDays(today, s);
  if (n === 0) return "heute";
  if (n === 1) return "morgen";
  if (n === -1) return "gestern";
  if (n > 1) return `in ${n} Tagen`;
  return `vor ${-n} Tagen`;
}
export function ago(ts) {
  const min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "vor 1 Tag" : `vor ${d} Tagen`;
}
export const timeOf = ts => new Intl.DateTimeFormat("de-CH", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
export const dateOfTs = ts => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));

// Schweizer Zahlen: 1'234.50
export function num(n, dec = 0) {
  const s = Math.abs(n).toFixed(dec);
  const [i, f] = s.split(".");
  return (n < 0 ? "−" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, "'") + (f ? "." + f : "");
}
export const chf = (n, dec = 0) => `${num(n, dec)}`;
export function mins(m) {
  m = Math.round(m);
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h} h ${r} min` : `${h} h`) : `${r} min`;
}
export const hours = m => num(m / 60, m % 60 ? 1 : 0);
export const hm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const toMin = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const uid = (p = "id") => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Deterministischer Zufall für Demodaten (gleiche Werte bei jedem Laden)
export function rng(seed) {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
