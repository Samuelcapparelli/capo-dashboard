// Eigene To-dos (Studium / Arbeit / CAPO / Privat) und die «3 wichtigsten Dinge heute»
import * as store from "./store.js";
import * as bwl from "./bwl.js";
import { todayISO, uid, dShort, addISO } from "./util.js";

export const KAT = { studium: "Studium", arbeit: "Arbeit", capo: "CAPO", privat: "Privat" };
export const PRIO = { hoch: "Hoch", mittel: "Mittel", tief: "Tief" };
const PRIO_ORDER = { hoch: 0, mittel: 1, tief: 2 };

export const all = () => store.get("todos", []);
export function add({ titel, kat = "privat", prio = "mittel", faellig = null }) {
  const t = { id: uid("td"), titel: titel.trim(), kat, prio, faellig, done: false, doneAm: null, erstellt: new Date().toISOString() };
  store.update("todos", [], l => [...l, t]);
  return t;
}
export function setKalender(id, uid, name) {
  store.update("todos", [], l => l.map(t => t.id === id ? { ...t, kalenderUid: uid, kalender: name } : t));
}
export function toggle(id) {
  store.update("todos", [], l => l.map(t => t.id === id ? { ...t, done: !t.done, doneAm: !t.done ? todayISO() : null } : t));
}
export function remove(id) {
  const before = all();
  store.set("todos", before.filter(t => t.id !== id));
  return () => store.set("todos", before);
}

// Einheitliche Einträge für Listen: eigene To-dos und Studiumsaufgaben aus dem BWL-Sync
export function todayItems(today = todayISO()) {
  const own = all().filter(t => (!t.done && (!t.faellig || t.faellig <= addISO(today, 1))) || (t.done && t.doneAm === today))
    .map(t => ({ ref: `todo:${t.id}`, titel: t.titel, kat: t.kat, prio: t.prio, done: t.done, info: t.faellig ? (t.faellig < today ? "überfällig" : t.faellig === today ? "heute" : dShort(t.faellig)) : "", hot: t.faellig && t.faellig < today && !t.done }));
  let study = [];
  if (bwl.data()) study = bwl.forToday(today).map(t => {
    const d = bwl.dueInfo({ ...t }, today);
    return { ref: `bwl:${t.id}`, titel: `${bwl.kurz(t.fach)}: ${t.titel}`, kat: "studium", prio: d.tone === "hot" ? "hoch" : "mittel", done: t.st === "done", info: `${bwl.ART_LABEL[t.art]} · ${d.label}`, hot: d.tone === "hot", task: t };
  });
  return [...own, ...study].sort((a, b) => a.done - b.done || PRIO_ORDER[a.prio] - PRIO_ORDER[b.prio]);
}

export function resolve(ref) {
  const [kind, id] = ref.split(":");
  if (kind === "todo") {
    const t = all().find(x => x.id === id);
    return t ? { ref, titel: t.titel, kat: t.kat, done: t.done } : null;
  }
  if (kind === "bwl" && bwl.data()) {
    const t = bwl.tasks().find(x => x.id === id);
    return t ? { ref, titel: `${bwl.kurz(t.fach)}: ${t.titel}`, kat: "studium", done: t.st === "done" } : null;
  }
  return null;
}
export function toggleRef(ref) {
  const [kind, id] = ref.split(":");
  if (kind === "todo") return toggle(id);
  const t = bwl.tasks().find(x => x.id === id);
  if (t) bwl.setStatus(id, t.st === "done" ? "offen" : "done");
}

/* ---------- Top 3 pro Tag; Unerledigtes wandert in den nächsten Tag ---------- */
export function top3(today = todayISO()) {
  let s = store.get("top3", { datum: today, refs: [] });
  if (s.datum !== today) {
    s = { datum: today, refs: s.refs.filter(r => { const x = resolve(r); return x && !x.done; }) };
    store.set("top3", s);
  }
  return s.refs.map(resolve).filter(Boolean);
}
export function setTop3(refs) { store.set("top3", { datum: todayISO(), refs: refs.slice(0, 3) }); }
export function toggleTop(ref) {
  const cur = store.get("top3", { datum: todayISO(), refs: [] }).refs;
  if (cur.includes(ref)) setTop3(cur.filter(r => r !== ref));
  else if (cur.length < 3) setTop3([...cur, ref]);
  else return false;
  return true;
}
export const isTop = ref => store.get("top3", { refs: [] }).refs.includes(ref);
