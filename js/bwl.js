// Studiumslogik auf Basis von data/bwl.json (BWL-Sync). Die Aufgaben-IDs sind dieselben wie im
// Semesterkompass (vb-…, nb-…, pp-…, t-…), damit Abhaken in Phase 2 in beide Richtungen synchronisiert.
import * as store from "./store.js";
import * as supa from "./supa.js";
import { todayISO, addISO, diffDays, pd, mondayISO, fridayOfWeek, dShort, WD, uid } from "./util.js";

let D = null;
export const data = () => D;
export const init = d => { D = d; };

export const faecher = () => D.faecher;
export const F = id => D.faecher.find(f => f.id === id) || { id, name: id === "alle" ? "Allgemein" : id, kurz: id === "alle" ? "Allgemein" : id, reihenfolge: 9 };
export const kurz = id => (id === "alle" ? "Allgemein" : F(id).kurz);

/* ---------- Status (im Dashboard abgehakt überschreibt den Sync-Stand, bis der Sync es in den Kompass übernommen hat) ---------- */
// Mit Anmeldung landen Änderungen in Supabase (bwl_checks, lernzeit); der BWL-Sync schreibt sie in den Kompass und quittiert.
// Ohne Netz bleiben sie als «dirty» lokal und werden beim nächsten Laden nachgeschickt.
const checks = () => store.get("bwl.checks", {});
export function statusOf(t) {
  const c = checks()[t.id];
  return c ? c.status : t.status;
}
const dirty = () => store.get("bwl.dirty", { checks: {}, add: {}, del: {} });
const markDirty = (kind, id, on) => store.update("bwl.dirty", { checks: {}, add: {}, del: {} }, d => {
  const x = { ...d[kind] }; if (on) x[id] = true; else delete x[id]; return { ...d, [kind]: x };
});
const pushCheck = id => {
  const c = checks()[id];
  return supa.rest("bwl_checks?on_conflict=owner,task_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { owner: supa.userId(), task_id: id, status: c.status, am: c.am } });
};
const pushAdd = z => supa.rest("lernzeit", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { owner: supa.userId(), id: z.id, datum: z.datum, fach: z.fach, minuten: z.minuten, notiz: z.notiz || "" } });
const pushDel = id => supa.rest(`lernzeit?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
function send(kind, id, job) {
  if (!supa.signedIn()) return;
  markDirty(kind, id, true);
  job().then(() => markDirty(kind, id, false)).catch(() => { /* bleibt dirty, wird beim nächsten Laden nachgeschickt */ });
}
export function setStatus(id, status) {
  store.update("bwl.checks", {}, c => ({ ...c, [id]: { status, am: new Date().toISOString() } }));
  send("checks", id, () => pushCheck(id));
}
// Beim Laden mit Anmeldung: Liegengebliebenes senden, dann den Stand aus Supabase übernehmen
export async function syncWithServer() {
  const d = dirty(), local = store.get("lernzeit", []);
  for (const id of Object.keys(d.checks)) if (checks()[id]) { await pushCheck(id); markDirty("checks", id, false); }
  for (const id of Object.keys(d.add)) { const z = local.find(x => x.id === id); if (z) await pushAdd(z); markDirty("add", id, false); }
  for (const id of Object.keys(d.del)) { await pushDel(id); markDirty("del", id, false); }
  const [rows, zeit] = await Promise.all([
    supa.rest("bwl_checks?select=task_id,status,am"),
    supa.rest("lernzeit?im_kompass=eq.false&select=id,datum,fach,minuten,notiz"),
  ]);
  store.set("bwl.checks", Object.fromEntries((rows || []).map(r => [r.task_id, { status: r.status, am: r.am }])));
  store.set("lernzeit", zeit || []);
}

export function tasks() {
  return D.aufgaben.map(t => ({ ...t, st: statusOf(t) }));
}
const isOpen = t => t.st !== "done" && t.st !== "skip";
// Vorbereitung nach der Lektion und Prüfungs-Wochenblöcke nach ihrer Woche sind hinfällig (wie im Kompass)
export const expired = (t, today = todayISO()) => isOpen(t) && ((t.art === "vorbereitung" && t.datum < today) || (t.art === "pruefung" && t.faellig < today));
// Überfällig werden nur Nachbearbeitungen und eigene Aufgaben; Vorbereitung gilt «noch bis zum Unterricht»
export const overdue = (t, today = todayISO()) => isOpen(t) && !expired(t, today) && t.art !== "vorbereitung" && t.faellig < today;

export const ART_LABEL = { vorbereitung: "Vorbereitung", nachbearbeitung: "Nachbearbeitung", nachholen: "Nachholen", pruefung: "Prüfungsvorbereitung", aufgabe: "Aufgabe" };

export function dueInfo(t, today = todayISO()) {
  if (t.st === "done") return { label: "erledigt", tone: "line" };
  if (t.st === "skip") return { label: "ausgelassen", tone: "line" };
  if (expired(t, today)) return { label: "verpasst", tone: "line" };
  if (t.art === "vorbereitung" && t.datum === today) return { label: "heute", tone: "hot" };
  if (t.art === "vorbereitung" && t.faellig < today) return { label: `noch bis ${WD[pd(t.datum).getDay()]}`, tone: "warn" };
  if (t.faellig < today) return { label: "überfällig", tone: "hot" };
  if (t.faellig === today) return { label: "heute", tone: "warn" };
  if (t.faellig === addISO(today, 1)) return { label: "morgen", tone: "" };
  return { label: dShort(t.faellig), tone: "" };
}

/* ---------- Auswahl für Heute und die Woche ---------- */
// Heute: was offen ist und bis morgen fällig (Nachbearbeitung erst ab dem Unterrichtstag)
export function forToday(today = todayISO()) {
  const tomorrow = addISO(today, 1);
  return tasks().filter(t => isOpen(t) && !expired(t, today) && t.faellig <= tomorrow && (t.art !== "nachbearbeitung" || t.datum <= today) && t.art !== "pruefung");
}
// Woche bis Freitag, gegliedert wie «Jetzt» im Kompass
export function thisWeek(today = todayISO()) {
  const wd = pd(today).getDay();
  const deadline = wd === 6 || wd === 0 ? fridayOfWeek(addISO(today, 7)) : fridayOfWeek(today);
  const lower = addISO(deadline, -6);
  const all = tasks();
  const recent = t => isOpen(t) || t.faellig >= lower;
  return {
    deadline,
    prep: all.filter(t => t.art === "vorbereitung" && t.st !== "skip" && t.datum >= today && t.faellig <= deadline),
    post: all.filter(t => (t.art === "nachbearbeitung" || t.art === "nachholen") && t.st !== "skip" && t.datum <= today && t.faellig <= deadline && recent(t)),
    other: all.filter(t => (t.art === "aufgabe" || t.art === "pruefung") && t.st !== "skip" && !expired(t, today) && t.faellig <= deadline && recent(t)),
  };
}

/* ---------- Termine ---------- */
const isSchool = t => (t.typ === "unterricht" || t.typ === "pitch" || t.typ === "pruefung") && !t.abwesend;
export const lessonsOn = date => D.termine.filter(t => t.datum === date && t.typ !== "frist");
export function nextSchoolDay(today = todayISO()) {
  return [...new Set(D.termine.filter(t => t.datum >= today && isSchool(t)).map(t => t.datum))].sort()[0] || null;
}
export function schoolDays(from = todayISO(), n = 6) {
  return [...new Set(D.termine.filter(t => t.datum >= from && t.typ !== "frist").map(t => t.datum))].sort().slice(0, n);
}
export function nextExam(today = todayISO()) {
  const p = D.pruefungen.filter(x => x.datum >= today).sort((a, b) => a.datum.localeCompare(b.datum));
  if (!p.length) return null;
  const datum = p[0].datum;
  return { datum, tage: diffDays(today, datum), faecher: p.filter(x => x.datum === datum) };
}
// Abgaben und Termine mit Frist: Fristen, Pitch/Leistungsnachweise, eigene Aufträge
export function deadlines(today = todayISO()) {
  const out = [
    ...D.fristen.map(f => ({ ...f, art: "Frist" })),
    ...D.leistungsnachweise.map(l => ({ ...l, art: "Leistungsnachweis" })),
    ...tasks().filter(t => t.art === "aufgabe" && isOpen(t)).map(t => ({ id: t.id, fach: t.fach, titel: t.titel, datum: t.faellig, zeitText: "", detail: "", art: "Auftrag", quelle: t.quelle, task: true })),
  ];
  return out.filter(x => x.datum >= today || x.task).sort((a, b) => a.datum.localeCompare(b.datum));
}

/* ---------- Leistungsnachweis pro Fach ---------- */
export function assessment(id, today = todayISO()) {
  const pr = D.pruefungen.find(p => p.fach === id && p.datum >= today);
  if (pr) return { art: "Prüfung", titel: `Semesterprüfung ${F(id).kurz}`, datum: pr.datum, tage: diffDays(today, pr.datum), gewicht: 1 };
  const ln = D.leistungsnachweise.find(l => l.fach === id && l.datum >= today);
  if (ln) return { art: "Leistungsnachweis", titel: ln.titel, datum: ln.datum, tage: diffDays(today, ln.datum), gewicht: 0.8 };
  const fr = D.fristen.find(f => f.fach === id && f.datum >= today);
  if (fr) return { art: "Frist", titel: fr.titel, datum: fr.datum, tage: diffDays(today, fr.datum), gewicht: 0.9 };
  // ohne festes Datum (z. B. VWL: «Ende 5. Semester»): Semesterende als Annahme
  return { art: "Leistungsnachweis", titel: "Ende Semester (Annahme)", datum: D.semester.ende, tage: diffDays(today, D.semester.ende), gewicht: 0.6, annahme: true };
}

/* ---------- Lernzeit ---------- */
// Lernzeit aus dem Kompass (Sync) plus im Dashboard erfasste, die noch nicht im Kompass sind
export const lernzeit = () => { const ids = new Set(D.lernzeit.map(z => z.id)); return [...D.lernzeit, ...store.get("lernzeit", []).filter(z => !ids.has(z.id))]; };
export const isPendingLernzeit = id => !D.lernzeit.some(z => z.id === id) && store.get("lernzeit", []).some(z => z.id === id);
export function addLernzeit(entry) {
  const z = { id: uid("z"), ...entry };
  store.update("lernzeit", [], l => [...l, z]);
  send("add", z.id, () => pushAdd(z));
}
export function removeLernzeit(id) {
  store.update("lernzeit", [], l => l.filter(z => z.id !== id));
  markDirty("add", id, false);
  send("del", id, () => pushDel(id));
}
export function budgetFor(mon) {
  const s = D.semester;
  if (s.pruefung && mon > mondayISO(s.pruefung)) return 0;
  if (s.pruefungsphaseAb && mon >= mondayISO(s.pruefungsphaseAb)) return s.budgetPruefungMin;
  return s.budgetNormalMin;
}
const inWeek = (s, mon) => s >= mon && s <= addISO(mon, 6);
export function weekLernzeit(mon) {
  const per = {};
  for (const z of lernzeit()) if (inWeek(z.datum, mon)) per[z.fach] = (per[z.fach] || 0) + z.minuten;
  return per;
}
// Geplant: Dauer der Aufgaben, die in dieser Woche fällig sind (ohne ausgelassene)
export function weekPlanned(mon) {
  const per = {};
  for (const t of tasks()) if (t.st !== "skip" && inWeek(t.faellig, mon)) per[t.fach] = (per[t.fach] || 0) + (t.dauer || 0);
  return per;
}

/* ---------- Stand, Ampel, Priorität pro Fach ---------- */
const SCHWAECHE = { stark: 1, mittel: 2, schwach: 3 };
export function fachStats(id, today = todayISO()) {
  const f = F(id), all = tasks().filter(t => t.fach === id);
  const ass = assessment(id, today);
  const relevant = all.filter(t => t.st !== "skip" && t.faellig <= ass.datum);
  const done = relevant.filter(t => t.st === "done").length;
  const od = all.filter(t => overdue(t, today));
  const week = thisWeek(today);
  const openWeek = [...week.prep, ...week.post, ...week.other].filter(t => t.fach === id && isOpen(t));
  const ls = f.lernstand;
  const stand = ls?.stand && SCHWAECHE[ls.stand] ? ls.stand : "offen";
  const luecken = ls?.luecken?.length || 0;
  const istMin = lernzeit().filter(z => z.fach === id).reduce((a, z) => a + z.minuten, 0);
  const sollMin = (f.sollStunden || 0) * 60;
  // Lernzeit-Rückstand zählt nur, wenn überhaupt Lernzeit erfasst wird
  const tracking = lernzeit().length > 0;
  const s = D.semester, span = Math.max(1, diffDays(s.lernstart || s.start, s.pruefung));
  const expected = sollMin * Math.min(1, Math.max(0, diffDays(s.lernstart || s.start, today) / span));
  const behind = tracking && sollMin > 0 && expected > 60 && istMin < expected * 0.5;

  // Ampel mit Begründung
  let ampel = "gruen", grund = "Auf Kurs";
  const reasons = [];
  if (od.length) reasons.push(`${od.length} überfällig`);
  if (stand === "schwach") reasons.push("Lernstand schwach");
  if (luecken) reasons.push(`${luecken} ${luecken === 1 ? "Lücke" : "Lücken"} im Lernstand`);
  if (behind) reasons.push("Lernzeit hinter Plan");
  if (f.offen?.length) reasons.push(`${f.offen.length} ${f.offen.length === 1 ? "offener Punkt" : "offene Punkte"}`);
  if (od.length >= 2 || (od.length && ass.tage <= 30) || (stand === "schwach" && ass.tage <= 60) || (ass.tage <= 21 && relevant.length && done / relevant.length < 0.5)) ampel = "rot";
  else if (od.length || luecken || behind || stand === "mittel" || f.offen?.length || (stand === "offen" && ass.tage <= 90)) ampel = "gelb";
  if (reasons.length) grund = reasons.join(" · ");
  else if (stand === "offen") grund = "Noch keine Einschätzung im Lernstand";

  // Priorität nach bwl-mentor: Schwäche × Prüfungsgewicht × Zeitdruck (+ Dringendes)
  const schwaeche = SCHWAECHE[stand] || 2;
  const zeitdruck = 1 + 90 / Math.max(ass.tage, 7);
  const score = schwaeche * ass.gewicht * zeitdruck + od.length * 0.75 + openWeek.length * 0.25;

  return {
    id, f, ass, stand, luecken, total: relevant.length, done, overdue: od, openWeek,
    progress: relevant.length ? done / relevant.length : 0, istMin, sollMin, ampel, grund, score,
  };
}
export function priorities(today = todayISO()) {
  return D.faecher.map(f => fachStats(f.id, today)).sort((a, b) => b.score - a.score);
}
export function fokusText(st) {
  const parts = [];
  if (st.overdue.length) parts.push(`${st.overdue.length} Aufgabe${st.overdue.length > 1 ? "n" : ""} überfällig`);
  if (st.openWeek.length) parts.push(`${st.openWeek.length} offen bis Freitag`);
  parts.push(`${st.ass.titel} ${st.ass.tage === 0 ? "heute" : `in ${st.ass.tage} Tagen`}`);
  if (st.stand !== "offen") parts.push(`Lernstand ${st.stand}`);
  return parts.join(" · ");
}

export function semesterInfo(today = todayISO()) {
  const s = D.semester;
  const total = diffDays(s.start, s.ende), gone = Math.min(total, Math.max(0, diffDays(s.start, today)));
  const week = Math.floor(gone / 7) + 1, weeks = Math.ceil(total / 7);
  const restSchultage = new Set(D.termine.filter(t => t.datum >= today && t.typ === "unterricht" && !t.abwesend).map(t => t.datum)).size;
  return { ...s, total, gone, frac: gone / total, week, weeks, restSchultage };
}
