// Startansicht «Heute»: max. 8 Karten, Details per Tipp
import * as bwl from "../bwl.js";
import * as todos from "../todos.js";
import { esc, todayISO, dMid, rel, num, hours, mondayISO, pd, zurichNow, toMin, timeOf } from "../util.js";
import { card, errorBox, I, ampel, bar } from "../ui.js";
import { sparkline } from "../charts.js";
import * as cal from "../cal.js";
import { MODULES } from "../config.js";
import { itemRow, timerHtml, importantMails } from "./shared.js";

export function render(ctx) {
  const today = todayISO();
  // Ein Grid: Querformat 7+5 / 4+5+3 / 5+4+3, Hochformat paarweise (p6)
  return `<div class="grid">
    ${top3Card(today)}
    ${studiumCard(ctx, today)}
    ${timelineCard(ctx, today)}
    ${todoCard(ctx, today)}
    ${MODULES.mails ? mailCard() : ""}
    ${MODULES.capo ? capoCard(ctx) : ""}
    ${fokusCard(ctx, today)}
    ${lernCard(ctx, today)}
  </div>`;
}

export function mount(root, ctx) {
  const el = root.querySelector("#spark-capo");
  if (el && ctx.capo.ok && ctx.capo.data.days.length) sparkline(el, ctx.capo.data.days.slice(-30).map(d => d.umsatz));
}

function top3Card(today) {
  const items = todos.top3(today);
  const slots = [0, 1, 2].map(i => {
    const it = items[i];
    if (!it) return `<button type="button" class="slot empty-slot" data-act="top-pick"><span class="n">${i + 1}</span><span class="t">Tippen, um zu wählen</span></button>`;
    return `<button type="button" class="slot${it.done ? " done" : ""}" data-act="toggle" data-ref="${esc(it.ref)}" aria-pressed="${it.done}" aria-label="${esc(it.titel)}${it.done ? ", erledigt" : ""}">
      <span class="n">${it.done ? "✓" : i + 1}</span><span><span class="t">${esc(it.titel)}</span><br><span class="c">${esc(todos.KAT[it.kat])}</span></span></button>`;
  }).join("");
  const done = items.filter(i => i.done).length;
  const foot = items.length
    ? `<div class="bar-row" style="margin-top:16px"><span class="small">${done} von ${items.length} erledigt</span><span class="small muted">Tippen hakt ab</span>${bar(done / 3)}</div>`
    : `<p class="meta" style="margin-top:16px">Tipp: Der Stern bei einem To-do setzt es hier ein. Unerledigtes wandert in den nächsten Tag.</p>`;
  return card({ cls: "s7 stretch flexcol", title: "Die 3 wichtigsten Dinge heute", head: `<button type="button" class="card-link" data-act="top-pick">Wählen${I.arrow}</button>`, body: `<div class="top3">${slots}</div>${foot}` });
}

function studiumCard(ctx, today) {
  if (!ctx.bwl.ok) return card({ cls: "s5 p6 stretch", title: "Studium", body: errorBox("Studiumsdaten", ctx.bwl.error) });
  const ex = bwl.nextExam(today);
  const school = bwl.nextSchoolDay(today);
  const lessons = school ? bwl.lessonsOn(school) : [];
  const dl = bwl.deadlines(today);
  const frist = dl.find(d => d.art !== "Auftrag");
  const auftrag = dl.find(d => d.art === "Auftrag");
  const week = bwl.thisWeek(today);
  const open = [...week.prep, ...week.post, ...week.other].filter(t => t.st !== "done");
  return `<section class="card ink s5 p6 stretch">
    <div class="card-head"><h2 class="card-title">Studium · ${esc(bwl.data().semester.nummer)}. Semester</h2><button type="button" class="card-link" data-go="studium" style="color:inherit">Alle${I.arrow}</button></div>
    ${ex ? `<div class="countdown">
      <p class="big xl">${ex.tage}</p>
      <p class="small" style="opacity:.7">Tage bis zur nächsten Prüfung</p>
      <p>${esc(ex.faecher.map(p => bwl.kurz(p.fach)).join(" und "))} · ${esc(dMid(ex.datum))}</p>
    </div>` : '<p class="muted">Keine Prüfung mehr in diesem Semester.</p>'}
    <ul class="list" style="margin-top:18px">
      ${school ? `<li class="row"><div class="grow"><p class="t2" style="color:inherit;opacity:.62">Nächster Schultag · ${esc(rel(school, today))}</p><p class="t1">${esc(dMid(school))}: ${esc(lessons.map(l => `${bwl.kurz(l.fach)}${l.zeitText ? ` ${l.zeitText}` : ""}`).join(", "))}</p></div></li>` : ""}
      ${frist ? `<li class="row"><div class="grow"><p class="t2" style="color:inherit;opacity:.62">Nächste Abgabe · ${esc(rel(frist.datum, today))}</p><p class="t1">${esc(frist.titel)} · ${esc(dMid(frist.datum))}</p></div></li>` : ""}
      ${auftrag ? `<li class="row"><div class="grow"><p class="t2" style="color:inherit;opacity:.62">Nächster Auftrag · ${esc(auftrag.datum < today ? "überfällig" : rel(auftrag.datum, today))}</p><p class="t1">${esc(bwl.kurz(auftrag.fach))}: ${esc(auftrag.titel)}</p></div></li>` : ""}
      <li class="row"><div class="grow"><p class="t1">${open.length ? `${open.length} Studiumsaufgaben offen bis ${esc(dMid(week.deadline))}` : "Diese Woche alles erledigt"}</p></div></li>
    </ul>
  </section>`;
}

function timelineCard(ctx, today) {
  const now = zurichNow().minutes;
  // Ganztägiges zuerst, dann nach Uhrzeit; Schultermine «abends» ohne Uhrzeit um 17 Uhr einordnen
  const ev = cal.eventsFor(ctx, today, today).map(e => ({ ...e, sort: e.von ? toMin(e.von) : e.zeitText && /abend/i.test(e.zeitText) ? 17 * 60 : -1 }));
  ev.sort((a, b) => a.sort - b.sort);
  const isTue = pd(today).getDay() === 2;
  let nowPlaced = false;
  const items = ev.map(e => {
    const end = e.bis ? toMin(e.bis) : e.sort + 60, past = e.sort >= 0 && end < now;
    let line = "";
    if (!nowPlaced && e.sort >= 0 && e.sort > now) { nowPlaced = true; line = `<div class="now-line" aria-hidden="true"><span>Jetzt</span></div>`; }
    return `${line}<li class="${e.cal}${past ? " past" : ""}"><p class="when">${esc(e.von ? `${e.von}${e.bis ? `–${e.bis}` : ""}` : e.zeitText || "ganztägig")}</p><p class="what">${esc(e.titel)}</p></li>`;
  }).join("");
  return card({
    cls: "s4 p6 stretch", title: "Heute", demo: !ctx.sources.kalender.live, link: "kalender",
    body: `${isTue ? '<p class="pill warn" style="margin-bottom:12px">Freier Tag · Schule, Lernen, CAPO</p>' : ""}
      ${ev.length ? `<ul class="timeline">${items}${nowPlaced ? "" : '<div class="now-line" aria-hidden="true"><span>Jetzt</span></div>'}</ul>` : '<p class="empty">Keine Termine heute.</p>'}`,
  });
}

function todoCard(ctx, today) {
  const items = todos.todayItems(today);
  const open = items.filter(i => !i.done).length;
  return card({
    cls: MODULES.mails ? "s5 stretch" : "s8 stretch", title: `To-dos · ${open} offen`,
    head: `<button type="button" class="card-link" data-act="todo-new">${I.plus}Neu</button>`,
    body: items.length ? `<ul class="list">${items.map(it => itemRow(it)).join("")}</ul>` : '<p class="empty">Nichts fällig. Mit «Neu» eine Aufgabe anlegen.</p>',
  });
}

function mailCard() {
  const mails = importantMails();
  const unread = mails.filter(m => !m.read);
  return card({
    cls: "s3 stretch", title: "Mails", demo: true, link: "mails",
    body: `<p class="big m">${unread.length}<span class="unit">ungelesen</span></p>
      <ul class="list" style="margin-top:12px">${mails.slice(0, 3).map(m => `<li class="row" style="min-height:0;align-items:flex-start"><div class="grow"><p class="t1 clip" style="font-size:15px${m.read ? "" : ";font-weight:500"}">${esc(m.from)}</p><p class="t2 clip">${esc(m.subj)}</p></div><span class="meta">${esc(timeOf(m.ts))}</span></li>`).join("")}</ul>`,
  });
}

function capoCard(ctx) {
  if (!ctx.capo.ok) return card({ cls: "s5 p6 stretch", title: "CAPO", body: errorBox("Shop-Daten", ctx.capo.error) });
  const { days, offen, besucher, fehler = {} } = ctx.capo.data;
  const sum = n => days.slice(-n).reduce((a, d) => a + d.umsatz, 0);
  const oldest = offen[0];
  const info = [
    fehler.offen ? "Offene Bestellungen nicht verfügbar" : `${offen.length} offene Bestellungen${oldest ? ` · älteste ${oldest.alter} Tage` : ""}`,
    besucher ? `${num(besucher.d7)} Besucher in 7 Tagen` : "",
  ].filter(Boolean).join(" · ");
  return card({
    cls: "s5 p6 stretch", title: "CAPO · Umsatz", demo: !ctx.sources.capo.live, link: "capo",
    body: `${days.length ? `<div class="kpis">
        <div class="kpi"><p class="big">${num(sum(1))}</p><p class="stat-label">CHF heute</p></div>
        <div class="kpi"><p class="big">${num(sum(7))}</p><p class="stat-label">CHF 7 Tage</p></div>
      </div>
      <div class="spark" id="spark-capo" style="margin:16px 0 4px" aria-label="Umsatz der letzten 30 Tage"></div>` : `<p class="empty">Verkaufszahlen nicht verfügbar: ${esc(fehler.verkauf || "keine Daten")}</p>`}
      <p class="meta">${esc(info)}</p>`,
  });
}

function fokusCard(ctx, today) {
  if (!ctx.bwl.ok) return card({ cls: "s4 p6 stretch", title: "Fokus", body: errorBox("Studiumsdaten", ctx.bwl.error) });
  const pr = bwl.priorities(today), top = pr[0];
  return card({
    cls: MODULES.capo ? "s4 p6 stretch" : "s6 p6 stretch", title: "Fokus als Nächstes", link: "studium",
    body: `<p style="font-size:26px;font-weight:300;letter-spacing:-.02em;line-height:1.15">${esc(top.f.name)}</p>
      <p class="small muted" style="margin-top:6px">${esc(bwl.fokusText(top))}</p>
      <ul class="list" style="margin-top:14px">${pr.map(s => `<li class="row" style="min-height:44px;padding:6px 0"><span class="grow">${esc(s.f.kurz)}</span>${ampel(s.ampel)}</li>`).join("")}</ul>`,
  });
}

function lernCard(ctx, today) {
  if (!ctx.bwl.ok) return card({ cls: "s3 stretch", title: "Lernzeit", body: errorBox("Studiumsdaten", ctx.bwl.error) });
  const mon = mondayISO(today), ziel = bwl.budgetFor(mon);
  const ist = Object.values(bwl.weekLernzeit(mon)).reduce((a, b) => a + b, 0);
  return card({
    cls: MODULES.capo ? "s3 stretch" : "s6 stretch", title: "Lernzeit Woche", link: "studium",
    body: `<p class="big m">${ist < 60 ? `${ist}<span class="unit">min</span>` : `${esc(hours(ist))}<span class="unit">h</span>`}</p>
      <p class="stat-label">von ${esc(hours(ziel))} h Wochenziel</p>
      <div style="margin:14px 0 16px">${bar(ziel ? ist / ziel : 0)}</div>
      ${timerHtml({ compact: true })}
      <p class="meta" style="margin-top:12px">Lernfenster: Abende und Dienstag</p>`,
  });
}
