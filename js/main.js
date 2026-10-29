// Start, Navigation, Kopfzeile, Aktualisierung (alle 10 Min.), Aktionen
import * as store from "./store.js";
import * as bwl from "./bwl.js";
import * as todos from "./todos.js";
import { SOURCES, loadBwl, loadWeather, loadCapo, loadKalender, createTermin } from "./data.js";
import * as supa from "./supa.js";
import * as cal from "./cal.js";
import { MODULES } from "./config.js";
import { I, initSheet, openSheet, closeSheet, toast } from "./ui.js";
import { esc, zurichNow, todayISO, dLong, isoWeek, timeOf, ago, mins, mondayISO } from "./util.js";
import { unreadCount, timerState } from "./views/shared.js";
import * as heute from "./views/heute.js";
import * as studium from "./views/studium.js";
import * as capo from "./views/capo.js";
import * as kalender from "./views/kalender.js";
import * as mails from "./views/mails.js";

const POLL_MS = 10 * 60 * 1000;
// Online (https, nicht localhost) ohne Anmeldung: nur das Anmeldefenster, keine Demo- oder Studiumsdaten. Lokal mit ?gate testbar.
const HOSTED = (location.protocol === "https:" && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) || new URLSearchParams(location.search).has("gate");
const gated = () => HOSTED && !supa.signedIn();
const SYNC_WARN_H = 24;
const VIEWS = { heute, studium, capo, kalender, mails };
const TABS = [["heute", "Heute"], ["studium", "Studium"], ["capo", "CAPO"], ["kalender", "Kalender"], ["mails", "Mails"]].filter(([k]) => k !== "mails" || MODULES.mails);
if (!MODULES.mails) delete VIEWS.mails;
const $ = id => document.getElementById(id);

const ctx = {
  bwl: { ok: false, error: "Wird geladen" }, capo: { ok: false, error: "Wird geladen" }, weather: null,
  kal: { ok: false, pending: true, error: "Wird geladen" }, kalAround: todayISO(),
  sources: SOURCES, updatedAt: null, day: todayISO(),
  rerender: () => renderView(false), go: tab => go(tab),
  // Kalender um ein Datum nachladen (Navigation über das geladene Fenster hinaus)
  loadKal: async iso => { ctx.kalAround = iso; await loadKal(); renderView(false); },
};
async function loadKal() {
  const w = cal.windowFor(ctx.kalAround, mondayISO);
  try {
    const d = await loadKalender(w.from, w.to);
    ctx.kal = { ok: true, data: d };
  } catch (e) { ctx.kal = { ok: false, error: e.message }; }
}
let tab = store.get("ui.tab", "heute");
if (!VIEWS[tab]) tab = "heute";

/* ---------- Laden: jede Quelle einzeln, Fehler bleiben im Modul ---------- */
async function loadAll() {
  // Wetter blockiert nichts: kommt es später, wird nur der Kopf neu gezeichnet
  loadWeather().then(w => { ctx.weather = w; }, () => { ctx.weather = null; }).finally(renderHeader);
  if (gated()) { ctx.updatedAt = Date.now(); renderHeader(); renderTabs(); renderView(false); return; }
  const [b, c] = await Promise.allSettled([loadBwl(), loadCapo(), loadKal()]);
  if (b.status === "fulfilled") { bwl.init(b.value); ctx.bwl = { ok: true, data: b.value }; }
  else ctx.bwl = bwl.data() ? { ok: true, data: bwl.data(), stale: true } : { ok: false, error: b.reason?.message || "Daten fehlen" };
  ctx.capo = c.status === "fulfilled" ? { ok: true, data: c.value } : { ok: false, error: c.reason?.message || "Shop-Daten fehlen" };
  ctx.updatedAt = Date.now();
  ctx.day = todayISO();
  renderHeader();
  renderTabs();
  renderView(false);
}

/* ---------- Kopf ---------- */
function renderHeader() {
  const now = zurichNow(), today = todayISO();
  $("h-greeting").textContent = `${now.h < 11 ? "Guten Morgen" : now.h < 17 ? "Guten Tag" : "Guten Abend"}${gated() ? "" : ", Samuel"}`;
  $("h-kicker").textContent = "Persönliches Dashboard";
  $("h-date").innerHTML = `${esc(dLong(today))} · <b>KW ${isoWeek(today)}</b>`;
  const w = ctx.weather;
  $("h-weather").innerHTML = w ? `${I.wx[w.icon] || I.wx.cloud}<span class="temp">${w.temp}°</span><span class="wx">Baar · ${esc(w.text)}<br>${w.min}° / ${w.max}°${w.regen != null ? ` · Regen ${w.regen} %` : ""}</span>` : '<span class="wx">Wetter Baar nicht verfügbar</span>';
  const sync = $("h-sync");
  if (gated()) { sync.className = "sync"; sync.textContent = ""; }
  else if (ctx.bwl.ok) {
    const h = (Date.now() - new Date(ctx.bwl.data.syncedAt).getTime()) / 3600e3;
    sync.className = `sync${h > SYNC_WARN_H ? " warn" : ""}`;
    sync.textContent = `${h > SYNC_WARN_H ? "BWL-Sync veraltet · " : "Zuletzt synchronisiert "}${ago(ctx.bwl.data.syncedAt)} (${timeOf(ctx.bwl.data.syncedAt)})`;
  } else { sync.className = "sync warn"; sync.textContent = "BWL-Sync: keine Daten"; }
  $("h-updated").textContent = ctx.updatedAt ? `Zuletzt aktualisiert ${timeOf(ctx.updatedAt)}` : "Wird geladen …";
  const acc = $("btn-account");
  acc.innerHTML = supa.signedIn() ? I.userOn : I.user;
  acc.title = supa.signedIn() ? `Angemeldet: ${supa.email()}` : "Anmelden";
}
function renderTabs() {
  document.querySelector(".tabs").hidden = gated();
  const n = MODULES.mails ? unreadCount() : 0;
  $("tabs").innerHTML = TABS.map(([k, l]) => `<button type="button" class="tab" role="tab" id="tab-${k}" aria-selected="${k === tab}" aria-controls="view" data-go="${k}">${l}${k === "mails" && n ? `<span class="badge" aria-label="${n} ungelesen">${n}</span>` : ""}</button>`).join("");
}
function renderView(animate) {
  const root = $("view"), v = VIEWS[tab];
  root.setAttribute("aria-labelledby", `tab-${tab}`);
  if (gated()) {
    root.innerHTML = `<section class="card" style="max-width:520px;margin:48px auto 0">
      <p class="kicker">Privat</p>
      <h2 style="font-size:32px;font-weight:300;letter-spacing:-.02em;margin:10px 0 10px">Anmelden</h2>
      <p class="muted">Dieses Dashboard ist privat. Nach der Anmeldung erscheinen Studium, CAPO und Kalender.</p>
      <button type="button" class="btn primary" data-act="login" style="margin-top:22px">${I.user}Anmelden</button>
    </section>`;
    return;
  }
  try {
    root.innerHTML = v.render(ctx);
    v.mount?.(root, ctx);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="card"><p class="t1">Diese Ansicht konnte nicht gezeichnet werden.</p><p class="meta">${esc(e.message)}</p></div>`;
  }
  if (animate) { root.classList.remove("enter"); void root.offsetWidth; root.classList.add("enter"); }
  tickTimer();
}
function go(next) {
  if (!VIEWS[next]) return;
  tab = next; store.set("ui.tab", tab);
  renderTabs(); renderView(true);
  const tabsTop = document.querySelector(".tabs").offsetTop;
  if (window.scrollY > tabsTop) window.scrollTo({ top: tabsTop, behavior: "instant" });
}

/* ---------- Timer-Anzeige ---------- */
function tickTimer() {
  for (const el of document.querySelectorAll("[data-clock]")) {
    const s = Math.floor((Date.now() - Number(el.dataset.clock)) / 1000);
    el.textContent = s < 3600 ? `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")} h`;
  }
}

/* ---------- Sheets ---------- */
function sheetTodo(datum) {
  const seg = (name, opts, val) => `<div class="seg" role="radiogroup">${Object.entries(opts).map(([k, l]) => `<button type="button" data-seg="${name}" data-v="${k}" aria-pressed="${k === val}">${l}</button>`).join("")}</div><input type="hidden" name="${name}" value="${val}">`;
  const kat = tab === "studium" ? "studium" : tab === "capo" ? "capo" : "privat";
  const kals = cal.writable(ctx);
  const pick = kals.find(k => cal.catOf(k) === kat) || kals[0];
  // Zurückschreiben in iCloud: als Termin (ganztägig oder mit Uhrzeit), nicht in Apple Erinnerungen
  const kalField = kals.length ? `<label class="field" style="grid-template-columns:auto 1fr;align-items:center;gap:12px"><input type="checkbox" name="inkal" ${tab === "kalender" ? "checked" : ""} style="width:22px;height:22px;accent-color:var(--ink)"><span>Auch in den iCloud-Kalender eintragen</span></label>
    <label class="field"><span>Kalender</span><select class="input" name="kalender">${kals.map(k => `<option value="${esc(k.id)}"${k === pick ? " selected" : ""}>${esc(k.name)}</option>`).join("")}</select></label>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="field"><span>Von (leer = ganztägig)</span><input class="input" type="time" name="von"></label><label class="field"><span>Bis</span><input class="input" type="time" name="bis"></label></div>`
    : `<p class="small muted">${supa.signedIn() ? "Kein beschreibbarer iCloud-Kalender verfügbar." : "Nach der Anmeldung lässt sich die Aufgabe auch in den iCloud-Kalender eintragen."}</p>`;
  openSheet("Neue Aufgabe", `<form class="form" data-form="todo-add">
    <label class="field"><span>Titel</span><input class="input" name="titel" required autocomplete="off" enterkeyhint="done" placeholder="Was ist zu tun?"></label>
    <div class="field"><span>Kategorie</span>${seg("kat", todos.KAT, kat)}</div>
    <div class="field"><span>Priorität</span>${seg("prio", todos.PRIO, "mittel")}</div>
    <label class="field"><span>Fällig</span><input class="input" type="date" name="faellig" value="${esc(datum || todayISO())}"></label>
    ${kalField}
    <div class="form-actions"><button type="button" class="btn" data-close>Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div>
  </form>`);
}
function sheetTopPick() {
  const today = todayISO();
  const items = [...todos.todayItems(today).filter(i => !i.done), ...todos.all().filter(t => !t.done && t.faellig && t.faellig > today).map(t => ({ ref: `todo:${t.id}`, titel: t.titel, kat: t.kat }))];
  const seen = new Set(), list = items.filter(i => !seen.has(i.ref) && seen.add(i.ref));
  openSheet("Die 3 wichtigsten Dinge", `<p class="small muted" style="margin-bottom:12px">Bis zu drei wählen. Unerledigtes wandert in den nächsten Tag.</p>
    <div class="pick">${list.map(i => `<button type="button" data-act="pick-top" data-ref="${esc(i.ref)}" aria-pressed="${todos.isTop(i.ref)}"><span class="star" aria-hidden="true" style="margin:0;color:${todos.isTop(i.ref) ? "var(--accent)" : "var(--faint)"}">${I.star}</span><span class="grow"><span class="small muted">${esc(todos.KAT[i.kat])}</span><br>${esc(i.titel)}</span></button>`).join("") || '<p class="empty">Keine offenen Aufgaben.</p>'}</div>
    <form class="toolbar" data-form="top-new" style="margin-top:14px"><input class="input" name="titel" placeholder="Oder neu eingeben …" autocomplete="off" enterkeyhint="done" style="flex:1"><button class="btn primary" type="submit">${I.plus}Hinzufügen</button></form>`);
}
function sheetTimer() {
  openSheet("Lernzeit starten", `<p class="small muted" style="margin-bottom:12px">Für welches Fach?</p><div class="pick">${bwl.faecher().map(f => `<button type="button" data-act="timer-start" data-fach="${esc(f.id)}"><span class="grow">${esc(f.name)}</span><span class="meta">${esc(f.kurz)}</span></button>`).join("")}</div>`);
}
function sheetManual() {
  openSheet("Lernzeit nachtragen", `<form class="form" data-form="lz-add">
    <label class="field"><span>Fach</span><select class="input" name="fach">${bwl.faecher().map(f => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join("")}</select></label>
    <label class="field"><span>Minuten</span><input class="input" name="minuten" type="number" inputmode="numeric" min="1" max="600" required value="30"></label>
    <label class="field"><span>Datum</span><input class="input" name="datum" type="date" value="${todayISO()}"></label>
    <label class="field"><span>Notiz (optional)</span><input class="input" name="notiz" autocomplete="off"></label>
    <div class="form-actions"><button type="button" class="btn" data-close>Abbrechen</button><button type="submit" class="btn primary">Speichern</button></div>
  </form>`);
}

function sheetAccount() {
  if (supa.signedIn()) {
    openSheet("Konto", `<p class="small muted">Angemeldet als</p><p style="font-size:18px;margin:4px 0 18px">${esc(supa.email())}</p>
      <p class="small muted" style="margin-bottom:18px">Live-Daten: CAPO (Wix). Kalender, Mails und Push folgen.</p>
      <div class="form-actions"><button type="button" class="btn" data-act="logout">Abmelden</button></div>`);
    return;
  }
  openSheet("Anmelden", `<form class="form" data-form="auth">
    <p class="small muted">Für Live-Daten aus Wix und später Kalender und Mails. Nur dein Konto hat Zugriff.</p>
    <label class="field"><span>E-Mail</span><input class="input" name="email" type="email" autocomplete="username" autocapitalize="none" autocorrect="off" required></label>
    <label class="field"><span>Passwort</span><input class="input" name="password" type="password" autocomplete="current-password" minlength="6" required></label>
    <p class="small accent" data-auth-msg role="alert"></p>
    <div class="form-actions"><button type="submit" class="btn" name="mode" value="up">Konto erstellen</button><button type="submit" class="btn primary" name="mode" value="in">Anmelden</button></div>
  </form>`);
}

/* ---------- Aktionen ---------- */
const ACTIONS = {
  toggle: el => {
    const was = todos.resolve(el.dataset.ref)?.done;
    todos.toggleRef(el.dataset.ref); renderView(false);
    if (!was) toast("Erledigt", () => { todos.toggleRef(el.dataset.ref); renderView(false); });
  },
  star: el => { if (!todos.toggleTop(el.dataset.ref)) toast("Top 3 sind schon voll"); renderView(false); },
  "top-pick": () => sheetTopPick(),
  "pick-top": el => {
    if (!todos.toggleTop(el.dataset.ref)) return toast("Top 3 sind schon voll");
    const on = todos.isTop(el.dataset.ref);
    el.setAttribute("aria-pressed", on); el.querySelector(".star").style.color = on ? "var(--accent)" : "var(--faint)";
    renderView(false);
  },
  "todo-new": el => sheetTodo(el.dataset.date),
  "todo-del": el => { const undo = todos.remove(el.dataset.id); renderView(false); toast("Aufgabe gelöscht", () => { undo(); renderView(false); }); },
  "bwl-toggle": el => {
    const t = bwl.tasks().find(x => x.id === el.dataset.id); if (!t) return;
    bwl.setStatus(t.id, t.st === "done" ? "offen" : "done"); renderView(false);
  },
  "bwl-skip": el => { bwl.setStatus(el.dataset.id, "skip"); renderView(false); toast("Ausgelassen", () => { bwl.setStatus(el.dataset.id, "offen"); renderView(false); }); },
  disclose: el => {
    const open = el.getAttribute("aria-expanded") !== "true";
    el.setAttribute("aria-expanded", open);
    document.getElementById(el.getAttribute("aria-controls"))?.classList.toggle("open", open);
  },
  "timer-pick": () => sheetTimer(),
  "timer-start": el => { store.set("timer", { fach: el.dataset.fach, start: Date.now() }); closeSheet(); renderView(false); },
  "timer-stop": () => {
    const t = timerState(); if (!t) return;
    const m = Math.max(1, Math.round((Date.now() - t.start) / 60000));
    bwl.addLernzeit({ datum: todayISO(), fach: t.fach, minuten: m, notiz: "Timer" });
    store.set("timer", null); renderView(false);
    toast(`${mins(m)} für ${bwl.kurz(t.fach)} erfasst`);
  },
  "lz-manual": () => sheetManual(),
  "lz-del": el => { bwl.removeLernzeit(el.dataset.id); renderView(false); },
  retry: () => loadAll(),
  login: () => sheetAccount(),
  logout: () => { supa.signOut(); store.set("cache.capo", null); closeSheet(); loadAll(); toast("Abgemeldet"); },
};
const FORMS = {
  auth: async (form, ctx, submitter) => {
    const msg = form.querySelector("[data-auth-msg]"), btns = form.querySelectorAll("button");
    btns.forEach(b => { b.disabled = true; });
    msg.textContent = "";
    try {
      if (submitter?.value === "up") {
        const d = await supa.signUp(form.email.value, form.password.value);
        if (!d.access_token) { msg.textContent = "Bestätigungsmail verschickt. Link öffnen, dann hier anmelden."; return; }
      } else await supa.signIn(form.email.value, form.password.value);
      closeSheet(); toast("Angemeldet"); loadAll();
    } catch (e) { msg.textContent = e.message; }
    finally { btns.forEach(b => { b.disabled = false; }); }
  },
  "todo-add": async form => {
    const titel = form.titel.value.trim(); if (!titel) return;
    const t = todos.add({ titel, kat: form.kat.value, prio: form.prio.value, faellig: form.faellig.value || null });
    const inKal = form.inkal?.checked, kalId = form.kalender?.value, von = form.von?.value || "", bis = form.bis?.value || "";
    closeSheet(); renderView(false);
    if (!inKal) return toast("Aufgabe gespeichert");
    try {
      const r = await createTermin({ kalender: kalId, titel, datum: t.faellig || todayISO(), von, bis, notiz: "Aus dem Dashboard" });
      todos.setKalender(t.id, r.uid, r.kalender);
      toast(`Gespeichert und in «${r.kalender}» eingetragen`);
      ctx.loadKal(ctx.kalAround);
    } catch (e) { toast(`Gespeichert, Kalender fehlgeschlagen: ${e.message}`); }
  },
  "top-new": form => {
    const titel = form.titel.value.trim(); if (!titel) return;
    const t = todos.add({ titel, kat: "privat", prio: "hoch", faellig: todayISO() });
    if (!todos.toggleTop(`todo:${t.id}`)) toast("Top 3 sind schon voll, als To-do gespeichert");
    closeSheet(); renderView(false);
  },
  "lz-add": form => {
    const m = Number(form.minuten.value); if (!(m > 0)) return;
    bwl.addLernzeit({ datum: form.datum.value || todayISO(), fach: form.fach.value, minuten: m, notiz: form.notiz.value.trim() });
    closeSheet(); renderView(false); toast("Lernzeit gespeichert");
  },
};

document.addEventListener("click", e => {
  const segBtn = e.target.closest("[data-seg]");
  if (segBtn) {
    const form = segBtn.closest("form");
    form.querySelectorAll(`[data-seg="${segBtn.dataset.seg}"]`).forEach(b => b.setAttribute("aria-pressed", b === segBtn));
    form.elements[segBtn.dataset.seg].value = segBtn.dataset.v;
    return;
  }
  const goEl = e.target.closest("[data-go]");
  if (goEl) return go(goEl.dataset.go);
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const fn = ACTIONS[el.dataset.act] || VIEWS[tab].actions?.[el.dataset.act];
  if (fn) fn(el, ctx);
});
document.addEventListener("submit", e => {
  const form = e.target.closest("form[data-form]");
  if (!form) return;
  e.preventDefault();
  const fn = FORMS[form.dataset.form] || VIEWS[tab].forms?.[form.dataset.form];
  if (fn) fn(form, ctx, e.submitter);
  if (form.dataset.form === "filter-add") renderTabs();
});

/* ---------- Theme: System → Hell → Dunkel ---------- */
function applyTheme() {
  const t = store.get("theme", "auto");
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  $("btn-theme").innerHTML = t === "dark" ? I.moon : t === "light" ? I.sun : I.auto;
  $("btn-theme").title = `Darstellung: ${t === "auto" ? "wie System" : t === "dark" ? "dunkel" : "hell"}`;
}
$("btn-theme").addEventListener("click", () => {
  const order = ["auto", "light", "dark"], cur = store.get("theme", "auto");
  store.set("theme", order[(order.indexOf(cur) + 1) % 3]); applyTheme();
});
$("btn-account").addEventListener("click", sheetAccount);
$("btn-refresh").innerHTML = I.refresh;
$("btn-refresh").addEventListener("click", async () => {
  const b = $("btn-refresh"); b.classList.remove("spin"); void b.offsetWidth; b.classList.add("spin");
  await loadAll(); toast("Aktualisiert");
});

/* ---------- Automatische Aktualisierung ---------- */
let hiddenAt = 0;
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (Date.now() - hiddenAt > 5 * 60 * 1000 || todayISO() !== ctx.day) loadAll();
});
setInterval(() => { if (!document.hidden) loadAll(); }, POLL_MS);
setInterval(() => {
  tickTimer();
  if (todayISO() !== ctx.day) loadAll(); // Tageswechsel
  else if (zurichNow().s === 0) renderHeader();
}, 1000);
store.on(key => { if (key === "mail.read" || key === "mail.filter") renderTabs(); });

// Offline-Cache nur im echten Betrieb (https); lokal stört er beim Entwickeln. Mit ?sw=1 lokal testbar.
if ("serviceWorker" in navigator && (location.protocol === "https:" || new URLSearchParams(location.search).has("sw"))) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

// Tab-Leiste bekommt ihren Hintergrund, sobald der Kopf weggescrollt ist
if ("IntersectionObserver" in window) {
  new IntersectionObserver(([e]) => document.querySelector(".tabs").classList.toggle("stuck", !e.isIntersecting)).observe($("top"));
} else document.querySelector(".tabs").classList.add("stuck");

initSheet();
applyTheme();
renderTabs();
loadAll();
