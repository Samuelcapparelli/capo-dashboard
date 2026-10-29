// Gemeinsame Bausteine der Ansichten: Aufgabenzeilen, Timer, Mail-Auswahl
import * as bwl from "../bwl.js";
import * as todos from "../todos.js";
import * as store from "../store.js";
import { esc, mins, todayISO, hm } from "../util.js";
import { I, source } from "../ui.js";
import { demoInbox, matchMail, DEFAULT_FILTER } from "../data.js";

// Zeile für Heute-Listen (eigene To-dos und Studiumsaufgaben gemischt)
export function itemRow(it, { star = true } = {}) {
  const top = todos.isTop(it.ref);
  const del = it.ref.startsWith("todo:") ? `<button type="button" class="star" data-act="todo-del" data-id="${esc(it.ref.slice(5))}" aria-label="Löschen: ${esc(it.titel)}">${I.trash}</button>` : "";
  return `<li class="task${it.done ? " done" : ""}">
    <button type="button" class="check hit" role="checkbox" aria-checked="${it.done}" data-act="toggle" data-ref="${esc(it.ref)}" aria-label="${esc(it.titel)}">${I.check}</button>
    <div class="grow">
      <div class="info"><span class="prio ${esc(it.prio)}" aria-hidden="true"></span><b>${esc(todos.KAT[it.kat] || it.kat)}</b>${it.info ? `<span class="${it.hot ? "accent" : ""}">${esc(it.info)}</span>` : ""}</div>
      <p class="t1">${esc(it.titel)}</p>
    </div>
    ${it.done ? "" : del}
    ${star && !it.done ? `<button type="button" class="star" data-act="star" data-ref="${esc(it.ref)}" aria-pressed="${top}" aria-label="${top ? "Aus den Top 3 entfernen" : "Zu den Top 3"}">${I.star}</button>` : ""}
  </li>`;
}

// Studiumsaufgabe mit Fälligkeit, Detail und Quelle zum Aufklappen
export function taskRow(t, { showFach = true, today = todayISO() } = {}) {
  const d = bwl.dueInfo(t, today);
  const done = t.st === "done", skip = t.st === "skip";
  const canSkip = !done && !skip && !bwl.expired(t, today) && (t.art === "vorbereitung" || t.art === "nachbearbeitung" || t.art === "nachholen");
  const id = `more-${t.id}`;
  return `<li class="task${done ? " done" : ""}${skip ? " skip" : ""}">
    <button type="button" class="check hit" role="checkbox" aria-checked="${done}" data-act="bwl-toggle" data-id="${esc(t.id)}" aria-label="${esc(t.titel)}">${I.check}</button>
    <div class="grow">
      <div class="info">${showFach ? `<b>${esc(bwl.kurz(t.fach))}</b>` : ""}<span>${esc(bwl.ART_LABEL[t.art])}</span><span class="pill ${d.tone}">${esc(d.label)}</span>${t.dauer ? `<span>${esc(mins(t.dauer))}</span>` : ""}</div>
      <button type="button" class="disclose" data-act="disclose" aria-expanded="false" aria-controls="${id}"><span class="t1">${esc(t.titel)}</span>${I.chev}</button>
      <div class="more" id="${id}"><div>
        ${t.detail ? `<p class="small muted">${esc(t.detail)}</p>` : ""}
        <p class="small muted">Fällig ${esc(t.faellig.split("-").reverse().join("."))}${t.datum ? ` · Unterricht ${esc(t.datum.split("-").reverse().join("."))}` : ""}</p>
        ${source(t.quelle)}
        ${canSkip ? `<button type="button" class="btn" style="margin-top:10px" data-act="bwl-skip" data-id="${esc(t.id)}">Auslassen</button>` : ""}
      </div></div>
    </div>
  </li>`;
}

/* ---------- Lernzeit-Timer ---------- */
export const timerState = () => store.get("timer", null);
export function timerHtml({ compact = false } = {}) {
  const t = timerState();
  if (!bwl.data()) return "";
  if (t) {
    const run = Math.floor((Date.now() - t.start) / 1000);
    return `<div class="timer running">
      <span class="clock" data-clock="${t.start}">${hm(Math.floor(run / 60))}</span>
      <div class="grow"><p class="small muted">Läuft für</p><p>${esc(bwl.F(t.fach).name)}</p></div>
      <button type="button" class="btn hot" data-act="timer-stop">${I.stop}Stopp</button>
    </div>`;
  }
  return `<div class="timer">
    ${compact ? "" : '<span class="clock faint">00:00</span>'}
    <button type="button" class="btn primary" data-act="timer-pick">${I.play}Lernzeit starten</button>
  </div>`;
}

/* ---------- Wichtige Mails (Demo bis Phase 2) ---------- */
export const mailFilter = () => store.get("mail.filter", DEFAULT_FILTER);
export function importantMails() {
  const read = new Set(store.get("mail.read", []));
  const f = mailFilter();
  return demoInbox().map(m => ({ ...m, rule: matchMail(m, f), read: read.has(m.id) })).filter(m => m.rule);
}
export const unreadCount = () => importantMails().filter(m => !m.read).length;
