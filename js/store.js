// Gespeicherter Zustand (To-dos, Top 3, abgehakte Studiumsaufgaben, Lernzeit, Timer, Mail-Filter).
// Phase 1: im Browser (localStorage). Phase 2: dieselben Schlüssel werden mit Supabase synchronisiert,
// die Ansichten merken davon nichts, weil sie nur get/set/on benutzen.
const PREFIX = "dash.";
const mem = new Map(); // Ersatz, falls localStorage gesperrt ist (privates Fenster)
const listeners = new Set();

export function get(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw != null) return JSON.parse(raw);
  } catch (e) {
    if (mem.has(key)) return mem.get(key);
  }
  return typeof fallback === "function" ? fallback() : fallback;
}

export function set(key, value) {
  mem.set(key, value);
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) { /* bleibt im Speicher dieser Sitzung */ }
  for (const fn of listeners) fn(key, value);
}

export function update(key, fallback, fn) {
  const next = fn(get(key, fallback));
  set(key, next);
  return next;
}

export const on = fn => { listeners.add(fn); return () => listeners.delete(fn); };
