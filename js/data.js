// Datenquellen. Jede Quelle wird einzeln geladen; fällt eine aus, laufen die anderen weiter.
// Phase 1: Studium = echte Daten (data/bwl.json aus dem BWL-Sync), Wetter = Open-Meteo,
// CAPO, Kalender und Mails = Demodaten. Phase 2 ersetzt die Demo-Funktionen durch Supabase-Abfragen.
import { rng, todayISO, addISO, pd, iso, add, zurichNow } from "./util.js";
import * as store from "./store.js";
import * as supa from "./supa.js";

export const SOURCES = {
  studium: { live: true, label: "BWL-Ordner (Sync)" },
  capo: { live: false, label: "Demodaten · für Live-Daten anmelden" },
  kalender: { live: false, label: "Demodaten · für iCloud anmelden" },
  mails: { live: false, label: "Demodaten · GMX folgt in Phase 2" },
};

async function getJSON(url, timeout = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* ---------- Studium ---------- */
// Mit Anmeldung aus Supabase (vom BWL-Sync hochgeladen), sonst die lokale Datei data/bwl.json
export async function loadBwl() {
  let fehler = null;
  if (supa.signedIn()) {
    try {
      const { syncWithServer } = await import("./bwl.js");
      await syncWithServer();
      const rows = await supa.rest("bwl_snapshot?select=data,synced_at");
      if (rows?.[0]?.data?.schema === 1) { SOURCES.studium.label = "Supabase (BWL-Sync)"; store.set("cache.bwl.at", Date.now()); return rows[0].data; }
      fehler = "Noch keine Studiumsdaten in Supabase: in Claude Code «Dashboard synchronisieren»";
    } catch (e) { fehler = e.message; }
  }
  try {
    const data = await getJSON(`data/bwl.json?t=${Date.now()}`);
    if (!data || data.schema !== 1) throw new Error("Unbekanntes Format von bwl.json");
    SOURCES.studium.label = "lokale Datei (BWL-Sync)";
    return data;
  } catch (e) { throw new Error(fehler || e.message); }
}

/* ---------- Wetter Baar (Open-Meteo, ohne Schlüssel) ---------- */
const WX = [
  [[0], "Klar", "sun"], [[1], "Überwiegend klar", "sun"], [[2], "Teilweise bewölkt", "cloudsun"], [[3], "Bedeckt", "cloud"],
  [[45, 48], "Nebel", "fog"], [[51, 53, 55, 56, 57], "Nieselregen", "rain"], [[61, 63, 65, 66, 67], "Regen", "rain"],
  [[71, 73, 75, 77], "Schnee", "snow"], [[80, 81, 82], "Regenschauer", "rain"], [[85, 86], "Schneeschauer", "snow"], [[95, 96, 99], "Gewitter", "storm"],
];
export async function loadWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=47.1963&longitude=8.5295&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FZurich&forecast_days=1";
  try {
    const d = await getJSON(url, 8000);
    const code = d.current.weather_code, w = WX.find(x => x[0].includes(code)) || [[], "–", "cloud"];
    const out = { temp: Math.round(d.current.temperature_2m), text: w[1], icon: w[2], max: Math.round(d.daily.temperature_2m_max[0]), min: Math.round(d.daily.temperature_2m_min[0]), regen: d.daily.precipitation_probability_max[0], at: Date.now() };
    store.set("cache.weather", out);
    return out;
  } catch (e) {
    const cached = store.get("cache.weather", null);
    if (cached && Date.now() - cached.at < 6 * 3600e3) return { ...cached, stale: true };
    throw e;
  }
}

/* ---------- CAPO: live über die Edge Function «wix-stats», ohne Anmeldung Demodaten ---------- */
const OFFLINE = /fetch|load failed|network|zeitüberschreitung/i;
export async function loadCapo() {
  if (!supa.signedIn()) { SOURCES.capo.live = false; return demoCapo(); }
  SOURCES.capo.live = true;
  try {
    const d = await supa.fn("wix-stats");
    const out = {
      days: d.days || [], offen: d.offen || [], lager: d.lager?.warnungen || [],
      lagerInfo: d.lager ? { produkte: d.lager.produkte, schwelle: d.lager.schwelle } : null,
      besucher: d.besucher, letzte: d.letzte, fehler: d.fehler || {}, at: Date.parse(d.at) || Date.now(),
    };
    store.set("cache.capo", out);
    return out;
  } catch (e) {
    // Offline: letzten Stand zeigen (höchstens 12 Stunden alt), sonst Fehler im Modul
    const c = store.get("cache.capo", null);
    if (c && OFFLINE.test(e.message) && Date.now() - c.at < 12 * 3600e3) return { ...c, stale: true };
    throw e;
  }
}

/* ---------- Kalender: live über die Edge Function «kalender» (iCloud), ohne Anmeldung null = Demo ---------- */
export async function loadKalender(from, to) {
  if (!supa.signedIn()) { SOURCES.kalender.live = false; return null; }
  SOURCES.kalender.live = true;
  try {
    const d = await supa.fn("kalender", { action: "list", from, to });
    const out = { kalender: d.kalender || [], events: d.events || [], fehler: d.fehler || {}, from: d.from, to: d.to, at: Date.parse(d.at) || Date.now() };
    store.set("cache.kal", out);
    return out;
  } catch (e) {
    const c = store.get("cache.kal", null);
    if (c && OFFLINE.test(e.message) && Date.now() - c.at < 24 * 3600e3) return { ...c, stale: true };
    throw e;
  }
}
export const createTermin = body => supa.fn("kalender", { action: "create", ...body });

/* ---------- CAPO (Demo) ---------- */
const PRODUCTS = [
  { name: "Longsleeve Black", preis: 89 }, { name: "Heavy Hoodie", preis: 149 },
  { name: "Oversized Tee", preis: 59 }, { name: "Logo Cap", preis: 45 },
];
export function demoCapo() {
  const today = todayISO(), now = zurichNow();
  const days = [], orders = [];
  let nr = 1000;
  for (let i = 59; i >= 0; i--) {
    const day = addISO(today, -i), r = rng("capo-" + day), wd = pd(day).getDay();
    const drop = i === 18 || i === 17; // ein Drop-Wochenende im Verlauf
    const base = (wd === 0 || wd === 6 ? 1.6 : 0.9) + (drop ? 5 : 0);
    const n = Math.floor(base * r() * 2.2);
    let umsatz = 0, count = 0;
    const visitors = Math.round((28 + (wd === 0 || wd === 6 ? 14 : 0) + (drop ? 120 : 0)) * (0.75 + r() * 0.5));
    for (let k = 0; k < n; k++) {
      const hour = 8 + Math.floor(r() * 14);
      if (i === 0 && hour > now.h) continue; // heute nur bis jetzt
      const items = [];
      const nItems = 1 + (r() < 0.3 ? 1 : 0);
      for (let j = 0; j < nItems; j++) items.push(PRODUCTS[Math.floor(r() * PRODUCTS.length)]);
      const summe = items.reduce((a, p) => a + p.preis, 0) + (items.length === 1 && items[0].preis < 100 ? 9 : 0);
      const age = i;
      const versandt = age > 4 || (age > 1 && r() < 0.6);
      orders.push({ nr: ++nr, datum: day, zeit: `${String(hour).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}`, artikel: items.map(p => p.name), betrag: summe, alter: age, status: versandt ? "Versandt" : (r() < 0.25 ? "In Bearbeitung" : "Bezahlt, nicht versandt") });
      umsatz += summe; count++;
    }
    days.push({ datum: day, umsatz, bestellungen: count, besucher: i === 0 ? Math.round(visitors * Math.min(1, now.h / 22)) : visitors });
  }
  // eine alte, liegengebliebene Bestellung, damit «älteste zuerst» sichtbar wird
  const late = orders.find(o => o.alter >= 8 && o.alter <= 12);
  if (late) late.status = "Bezahlt, nicht versandt";
  const offen = orders.filter(o => o.status !== "Versandt").sort((a, b) => b.alter - a.alter);
  const lager = [
    { produkt: "Heavy Hoodie", variante: "M", bestand: 2 }, { produkt: "Longsleeve Black", variante: "L", bestand: 1 },
    { produkt: "Logo Cap", variante: "One Size", bestand: 0 },
  ];
  const sumV = n => days.slice(-n).reduce((s, d) => s + d.besucher, 0);
  return {
    days, orders, offen, lager, at: Date.now(), fehler: {}, letzte: null, lagerInfo: { produkte: PRODUCTS.length, schwelle: 2 },
    besucher: { heute: days[days.length - 1].besucher, d7: sumV(7), d30: sumV(30), sessions30: Math.round(sumV(30) * 1.3) },
  };
}

/* ---------- Kalender (Demo-Kalender + echte Schultermine aus dem BWL-Sync) ---------- */
// Kalender: studium (Akzent), arbeit (Schwarz), capo (Grau), privat (Ring)
export function demoEvents(fromISO, toISO) {
  const out = [];
  for (let d = pd(fromISO); d <= pd(toISO); d = add(d, 1)) {
    const day = iso(d), wd = d.getDay();
    if ([1, 3, 4, 5].includes(wd)) out.push({ id: `w-${day}`, cal: "arbeit", datum: day, von: "08:00", bis: "17:00", titel: "Arbeit", ort: "Zug", demo: true });
    if (wd === 2) out.push({ id: `c-${day}`, cal: "capo", datum: day, von: "09:30", bis: "11:30", titel: "CAPO · Versand und Content", demo: true });
    if (wd === 4) out.push({ id: `p-${day}`, cal: "privat", datum: day, von: "19:00", bis: "20:30", titel: "Training", demo: true });
    if (wd === 6 && rng("sa-" + day)() < 0.5) out.push({ id: `s-${day}`, cal: "capo", datum: day, von: "14:00", bis: "16:00", titel: "CAPO · Shooting", demo: true });
  }
  return out;
}

/* ---------- Mails (Demo) ---------- */
export const DEFAULT_FILTER = {
  absender: ["kbz-zug.ch", "Wix", "Die Post", "WWZ"],
  stichwoerter: ["KBZ", "Schule", "Prüfung", "Bestellung", "Paket", "Diplomarbeit", "Campus"],
};
export function demoInbox() {
  const now = Date.now(), h = 3600e3;
  const m = (id, hrs, from, addr, subj, prev) => ({ id, ts: now - hrs * h, from, addr, subj, prev });
  return [
    m("m1", 0.6, "Wix Stores", "no-reply@wix-demo.example", "Neue Bestellung #1087 eingegangen", "Bezahlt, CHF 149.00 · Heavy Hoodie, Grösse M. Versand vorbereiten."),
    m("m2", 2.2, "KBZ Zug · Weiterbildung", "weiterbildung@kbz-zug.ch", "Raumänderung HFBWL24a am Dienstag", "Der Unterricht findet ausnahmsweise im Zimmer 2.14 statt."),
    m("m3", 3.5, "Galaxus", "news@galaxus-demo.example", "Die besten Deals der Woche", "Bis zu 40 % auf ausgewählte Produkte."),
    m("m4", 5, "Die Post", "noreply@post-demo.example", "Ihr Paket ist unterwegs", "Sendung 99.00.123456.78901234 wird heute zugestellt."),
    m("m5", 7, "Campus KBZ", "campus@kbz-zug.ch", "Neues Dokument in B521 Corporate Finance", "Im Kurs wurde eine neue Datei hochgeladen: Folien Block 2."),
    m("m6", 9, "LinkedIn", "messages@linkedin-demo.example", "Sie haben 3 neue Kontaktanfragen", "Erweitern Sie Ihr Netzwerk."),
    m("m7", 20, "Arbeit intern", "intern@arbeit-demo.example", "Einsatzplan November", "Der Einsatzplan für November ist online. Bitte bis Freitag prüfen."),
    m("m8", 26, "Wix", "billing@wix-demo.example", "Zahlung erhalten: Premium-Abo", "Vielen Dank, Ihre Zahlung wurde verbucht."),
    m("m9", 30, "Zalando", "info@zalando-demo.example", "Neue Styles für den Herbst", "Entdecken Sie die neuesten Trends."),
    m("m10", 40, "Leitung HFW", "hfw@kbz-zug.ch", "Diplomarbeit: Expertenliste 2026/27", "Im Anhang die aktuelle Liste der Erstexperten."),
    m("m11", 52, "Digitec", "service@digitec-demo.example", "Ihr Paket wurde zugestellt", "Ihre Bestellung wurde heute zugestellt."),
    m("m12", 60, "Spotify", "no-reply@spotify-demo.example", "Dein Mix der Woche", "Neue Songs, die dir gefallen könnten."),
  ];
}
export function matchMail(mail, filter) {
  const lc = s => String(s).toLowerCase();
  const by = filter.absender.find(a => a && (lc(mail.from).includes(lc(a)) || lc(mail.addr).includes(lc(a))));
  if (by) return `Absender: ${by}`;
  const kw = filter.stichwoerter.find(k => k && (lc(mail.subj).includes(lc(k)) || lc(mail.prev).includes(lc(k))));
  return kw ? `Stichwort: ${kw}` : null;
}
