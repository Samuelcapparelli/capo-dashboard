// Termine für Kalender und Heute: live aus iCloud (Edge Function «kalender»), ohne Anmeldung Demo-Kalender.
// Dazu die Schultermine aus dem BWL-Sync, ausser an Tagen, an denen ein Studium-Kalender schon Einträge hat (keine Doppelungen).
import * as store from "./store.js";
import * as bwl from "./bwl.js";
import { demoEvents } from "./data.js";
import { addISO, toMin } from "./util.js";

export const CATS = { studium: "Studium", arbeit: "Arbeit", capo: "CAPO", privat: "Privat", aus: "Ausblenden" };

// Zuordnung iCloud-Kalender → Darstellung (einmal pro Kalender, änderbar unter «Kalender zuordnen»)
function guess(name) {
  const n = name.toLowerCase();
  if (/studi|schule|kbz|bwl|hf\b|uni/.test(n)) return "studium";
  if (/arbeit|work|wwz|büro|buero|job/.test(n)) return "arbeit";
  if (/capo/.test(n)) return "capo";
  if (/feiertag|holiday|geburtstag|birthday/.test(n)) return "privat";
  return "privat";
}
export const mapping = () => store.get("kal.map", {});
export const catOf = k => mapping()[k.id] || guess(k.name);
export function setCat(id, cat) { store.update("kal.map", {}, m => ({ ...m, [id]: cat })); }

export const isLive = ctx => !!(ctx.kal?.ok && ctx.kal.data);
export const covers = (ctx, from, to) => isLive(ctx) && ctx.kal.data.from <= from && ctx.kal.data.to >= to;
export const writable = ctx => isLive(ctx) ? ctx.kal.data.kalender.filter(k => k.schreibbar && catOf(k) !== "aus") : [];

export function eventsFor(ctx, from, to) {
  let ev;
  if (isLive(ctx)) {
    const cats = Object.fromEntries(ctx.kal.data.kalender.map(k => [k.id, catOf(k)]));
    ev = ctx.kal.data.events.filter(e => e.datum >= from && e.datum <= to && cats[e.kal] !== "aus")
      .map(e => ({ ...e, cal: cats[e.kal] || "privat", zeitText: "" }));
  } else ev = ctx.kal?.ok === false ? [] : demoEvents(from, to); // beim Laden oder bei Fehler keine Demo-Termine vortäuschen
  if (bwl.data()) {
    const studiumDays = new Set(isLive(ctx) ? ev.filter(e => e.cal === "studium").map(e => e.datum) : []);
    for (const t of bwl.data().termine) {
      if (t.datum < from || t.datum > to) continue;
      const frist = t.typ === "frist", pruefung = t.typ === "pruefung";
      if (!frist && !pruefung && studiumDays.has(t.datum)) continue; // steht schon im iCloud-Kalender «Studium»
      ev.push({
        id: t.id, cal: "studium", bwl: true, datum: t.datum, von: t.von, bis: t.bis || (t.von ? addMin(t.von, 90) : null), ganztags: !t.von,
        titel: frist ? t.titel : `${bwl.kurz(t.fach)} · ${t.thema || t.titel}${t.abwesend ? " (abwesend)" : ""}`, zeitText: t.zeitText, frist, pruefung,
      });
    }
  }
  return ev.sort((a, b) => (a.datum + (a.von || "")).localeCompare(b.datum + (b.von || "")));
}
const addMin = (t, m) => { const x = toMin(t) + m; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };

// Ladefenster rund um ein Datum: 1 Woche zurück, 7 Wochen voraus (deckt Woche und Monat ab)
export const windowFor = (iso, mondayISO) => { const mon = mondayISO(iso); return { from: addISO(mon, -7), to: addISO(mon, 48) }; };
