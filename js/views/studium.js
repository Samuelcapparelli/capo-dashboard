// Ansicht «Studium»: Semester, Prüfungen, Abgaben, Ampel, Stundenplan, Checklisten, Lernzeit
import * as bwl from "../bwl.js";
import * as store from "../store.js";
import { esc, todayISO, dMid, dShort, dFull, rel, mins, mondayISO, addISO, isoWeek, diffDays, pd, MON } from "../util.js";
import { card, errorBox, I, ampel, bar, source } from "../ui.js";
import { taskRow, timerHtml } from "./shared.js";

let weekOffset = 0;

export function render(ctx) {
  if (!ctx.bwl.ok) return `<div class="grid">${card({ cls: "s12", title: "Studium", body: errorBox("Studiumsdaten (BWL-Sync)", ctx.bwl.error) })}</div>`;
  const today = todayISO();
  return `<div class="grid">${semesterCard(today)}</div>
  <div class="grid">${examsCard(today)}${deadlinesCard(today)}</div>
  <div class="section-title"><h2>Fächer</h2></div>
  <div class="grid">${ampelCard(today)}</div>
  <div class="grid">${scheduleCard(today)}${checklistCard(today)}</div>
  <div class="section-title"><h2>Lernzeit</h2></div>
  <div class="grid">${lernzeitCard(today)}</div>`;
}

function semesterCard(today) {
  const s = bwl.semesterInfo(today), D = bwl.data();
  const pos = d => `${Math.max(0, Math.min(100, diffDays(s.start, d) / s.total * 100))}%`;
  const school = [...new Set(D.termine.filter(t => t.typ === "unterricht").map(t => t.datum))];
  const ex = bwl.nextExam(today);
  return card({
    cls: "s12", title: `${s.nummer}. Semester · ${s.name}${s.klasse ? ` · Klasse ${s.klasse}` : ""}`,
    body: `<div class="kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="kpi"><p class="big">${s.week}<span class="unit">/ ${s.weeks}</span></p><p class="stat-label">Semesterwoche</p></div>
        <div class="kpi"><p class="big">${s.restSchultage}</p><p class="stat-label">Schultage übrig (${esc(s.schultag || "dienstags")})</p></div>
        <div class="kpi"><p class="big">${ex ? ex.tage : "–"}</p><p class="stat-label">Tage bis Semesterprüfung</p></div>
        <div class="kpi"><p class="big">${Math.round(s.frac * 100)}<span class="unit">%</span></p><p class="stat-label">Semester vorbei</p></div>
      </div>
      <div class="semline" role="img" aria-label="Semester vom ${dFull(s.start)} bis ${dFull(s.ende)}, heute bei ${Math.round(s.frac * 100)} Prozent">
        <div class="track"></div>
        ${s.pruefungsphaseAb ? `<div class="phase" style="left:${pos(s.pruefungsphaseAb)};width:calc(${pos(s.pruefung)} - ${pos(s.pruefungsphaseAb)})"></div>` : ""}
        <div class="done" style="width:${pos(today)}"></div>
        ${school.map(d => `<span class="tick" style="left:${pos(d)}"></span>`).join("")}
        <span class="exam" style="left:${pos(s.pruefung)}" title="Semesterprüfungen"></span>
        <span class="today" style="left:${pos(today)}"></span>
        <span class="mark start" style="left:0">${esc(dFull(s.start))}</span>
        ${s.pruefungsphaseAb ? `<span class="mark" style="left:${pos(s.pruefungsphaseAb)}">Prüfungsphase</span>` : ""}
        <span class="mark below" style="left:${pos(s.pruefung)}">Prüfung ${esc(dShort(s.pruefung))}</span>
        <span class="mark end" style="left:100%">${esc(dFull(s.ende))}</span>
      </div>
      <p class="meta" style="margin-top:22px">Striche: Schultage · schraffiert: Prüfungsphase (Lernbudget ${esc(mins(s.budgetPruefungMin))} pro Woche statt ${esc(mins(s.budgetNormalMin))})</p>
      ${source(s.quelle)}`,
  });
}

function examsCard(today) {
  const D = bwl.data();
  const list = D.pruefungen.filter(p => p.datum >= today);
  const body = list.length ? list.map(p => {
    const st = bwl.fachStats(p.fach, today), days = diffDays(today, p.datum), id = `stoff-${p.id}`;
    return `<div style="padding:14px 0;border-top:1px solid var(--line-2)">
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start">
        <div><p style="font-size:20px">${esc(bwl.F(p.fach).name)}</p><p class="meta">${esc(p.art)} · ${esc(dMid(p.datum))}${p.zeitText ? ` · ${esc(p.zeitText)}` : ""}</p></div>
        <p class="big m" style="text-align:right">${days}<span class="unit">Tage</span></p>
      </div>
      <div class="bar-row" style="margin-top:12px"><span class="small">Vorbereitung: ${st.done} von ${st.total} Aufgaben</span><span class="small muted">${Math.round(st.progress * 100)} %</span>${bar(st.progress)}</div>
      ${st.sollMin ? `<div class="bar-row" style="margin-top:10px"><span class="small">Lernzeit: ${esc(mins(st.istMin))} von ${esc(mins(st.sollMin))} Soll</span><span class="small muted">${Math.round(st.istMin / st.sollMin * 100)} %</span>${bar(st.istMin / st.sollMin)}</div>` : ""}
      <button type="button" class="disclose" data-act="disclose" aria-expanded="false" aria-controls="${id}" style="margin-top:6px"><span class="small">Stoffumfang · ${p.stoff.length} Lektionen</span>${I.chev}</button>
      <div class="more" id="${id}"><div>
        <ul class="list">${p.stoff.map(l => `<li class="row" style="min-height:0;padding:7px 0"><span class="meta" style="width:74px;flex:none">${esc(dShort(l.datum))}</span><span class="grow small">${esc(l.thema || "Thema folgt")}</span></li>`).join("")}</ul>
        <p class="small muted" style="margin-top:8px">${esc(p.modalitaeten)}</p>
        ${p.hinweis ? `<p class="small muted">${esc(p.hinweis)}</p>` : ""}
        ${source(p.quelle)}
      </div></div>
    </div>`;
  }).join("") : '<p class="empty">Keine Prüfungen mehr in diesem Semester.</p>';
  return card({ cls: "s6", title: "Prüfungen", body });
}

function deadlinesCard(today) {
  const dl = bwl.deadlines(today);
  // Fristen und Leistungsnachweise immer, von den eigenen Aufträgen nur die nächsten vier
  const auftraege = dl.filter(d => d.art === "Auftrag");
  const main = dl.filter(d => d.art !== "Auftrag" || auftraege.indexOf(d) < 4), rest = auftraege.slice(4);
  const row = d => {
    const n = diffDays(today, d.datum), late = n < 0;
    return `<li class="row"><div class="grow"><div class="task info" style="padding:0;margin:0"><b>${esc(bwl.kurz(d.fach))}</b><span>${esc(d.art)}</span></div>
      <p class="t1">${esc(d.titel)}</p>${d.detail ? `<p class="t2">${esc(d.detail)}</p>` : ""}${source(d.quelle)}</div>
      <div class="right"><p style="font-size:22px;font-weight:300" class="${late ? "accent" : ""}">${late ? "überfällig" : n === 0 ? "heute" : n === 1 ? "morgen" : `${n} T.`}</p><p class="meta">${esc(dShort(d.datum))}${d.zeitText ? ` · ${esc(d.zeitText)}` : ""}</p></div></li>`;
  };
  const body = dl.length ? `<ul class="list">${main.map(row).join("")}</ul>
    ${rest.length ? `<button type="button" class="disclose" data-act="disclose" aria-expanded="false" aria-controls="dl-rest"><span class="small">Weitere Aufträge · ${rest.length}</span>${I.chev}</button>
    <div class="more" id="dl-rest"><div><ul class="list">${rest.map(row).join("")}</ul></div></div>` : ""}` : '<p class="empty">Keine offenen Abgaben.</p>';
  return card({ cls: "s6", title: "Abgaben, Fristen, Aufträge", body });
}

function ampelCard(today) {
  const pr = bwl.priorities(today), top = pr[0];
  const rows = pr.map((s, i) => `<tr>
      <td><b style="font-weight:500">${esc(s.f.name)}</b><br><span class="meta">${esc([s.f.code, s.f.dozent].filter(Boolean).join(" · "))}</span></td>
      <td>${ampel(s.ampel)}<br><span class="meta">${esc(s.grund)}</span></td>
      <td>${esc(s.stand === "offen" ? "noch offen" : s.stand)}</td>
      <td class="num">${s.done}/${s.total}</td>
      <td class="num ${s.overdue.length ? "accent" : ""}">${s.overdue.length}</td>
      <td>${esc(s.ass.titel)}<br><span class="meta">${esc(dShort(s.ass.datum))} · ${s.ass.tage} Tage</span></td>
      <td class="num">${i + 1}</td>
    </tr>`).join("");
  return card({
    cls: "s12", title: "Ampel und Priorität",
    body: `<div class="notice" style="margin-bottom:16px"><div><b>Als Nächstes: ${esc(top.f.name)}.</b> ${esc(bwl.fokusText(top))}.</div></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Fach</th><th>Ampel</th><th>Lernstand</th><th class="num">Erledigt</th><th class="num">Überfällig</th><th>Nächster Leistungsnachweis</th><th class="num">Prio</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="meta" style="margin-top:12px">Priorität wie bwl-mentor: Schwäche × Prüfungsgewicht × Zeitdruck, plus Überfälliges. Lernstand aus 5 Semester/Lernstand.md.</p>`,
  });
}

function scheduleCard(today) {
  const days = bwl.schoolDays(today, 6);
  const body = days.length ? `<div class="days">${days.map(d => {
    const ls = bwl.lessonsOn(d);
    return `<div class="day"><p class="d"><b>${pd(d).getDate()}. ${esc(MON[pd(d).getMonth()])}</b>${esc(dShort(d).split(" ")[0])} · KW ${isoWeek(d)}<br>${esc(rel(d, today))}</p>
      <div>${ls.map(l => `<div class="lesson"><p class="t1">${esc(l.titel)}${l.zeitText ? ` <span class="meta">· ${esc(l.zeitText)}</span>` : ""}${l.abwesend ? ' <span class="pill line">abwesend</span>' : ""}</p>
        <p class="t2">${esc(l.thema || "Thema folgt")}${l.vorlaeufig ? " · vorläufig" : ""}</p></div>`).join("")}</div></div>`;
  }).join("")}</div>` : '<p class="empty">Keine Schultermine mehr.</p>';
  return card({ cls: "s5", title: "Stundenplan · nächste Schultage", body });
}

function checklistCard(today) {
  const fs = bwl.faecher();
  let sel = store.get("ui.fach", null);
  if (!fs.some(f => f.id === sel)) sel = bwl.priorities(today)[0].id;
  const all = bwl.tasks().filter(t => t.fach === sel);
  const termine = bwl.data().termine.filter(t => t.fach === sel && t.typ === "unterricht");
  const upcoming = termine.filter(t => t.datum >= addISO(today, -14));
  const groups = upcoming.map(l => {
    const ts = all.filter(t => t.termin === l.id);
    return `<div style="padding-top:12px"><p class="kicker" style="margin-bottom:2px">${esc(dMid(l.datum))} · ${esc(l.thema || "Thema folgt")}${l.vorlaeufig ? " · vorläufig" : ""}</p>
      <ul class="list">${ts.map(t => taskRow(t, { showFach: false, today })).join("")}</ul></div>`;
  }).join("");
  const own = all.filter(t => t.art === "aufgabe" || t.art === "pruefung").filter(t => !bwl.expired(t, today) && t.faellig <= addISO(today, 60));
  const past = termine.length - upcoming.length;
  return card({
    cls: "s7", title: "Vor- und Nachbearbeitung",
    body: `<div class="chips" role="group" aria-label="Fach wählen">${fs.map(f => `<button type="button" class="chip plain" data-act="fach" data-id="${esc(f.id)}" aria-pressed="${f.id === sel}">${esc(f.kurz)}</button>`).join("")}</div>
      ${own.length ? `<div style="padding-top:12px"><p class="kicker" style="margin-bottom:2px">Aufträge</p><ul class="list">${own.map(t => taskRow(t, { showFach: false, today })).join("")}</ul></div>` : ""}
      ${groups || '<p class="empty">Keine Lektionen in den nächsten Wochen.</p>'}
      ${past ? `<p class="meta" style="margin-top:12px">${past} frühere Lektionen ausgeblendet.</p>` : ""}`,
  });
}

function lernzeitCard(today) {
  const mon = addISO(mondayISO(today), weekOffset * 7), ziel = bwl.budgetFor(mon);
  const ist = bwl.weekLernzeit(mon), plan = bwl.weekPlanned(mon);
  const total = Object.values(ist).reduce((a, b) => a + b, 0);
  const fs = bwl.faecher();
  const max = Math.max(60, ...fs.map(f => Math.max(ist[f.id] || 0, plan[f.id] || 0)));
  const rows = fs.map(f => {
    const i = ist[f.id] || 0, p = plan[f.id] || 0;
    return `<div class="bar-row" style="padding:10px 0;border-top:1px solid var(--line-2)">
      <span>${esc(f.name)}${f.id === "da" ? ' <span class="meta">· ausserhalb Lernbudget</span>' : ""}</span>
      <span class="small muted">Ist ${esc(mins(i))} · geplant ${esc(mins(p))}</span>
      ${bar(i / max, false, p ? p / max : null)}
    </div>`;
  }).join("");
  const entries = bwl.lernzeit().filter(z => z.datum >= mon && z.datum <= addISO(mon, 6)).sort((a, b) => b.datum.localeCompare(a.datum));
  return `<section class="card s8">
      <div class="card-head"><h2 class="card-title">Geplant und tatsächlich</h2>
        <div class="toolbar"><button type="button" class="icon-btn" data-act="week" data-d="-1" aria-label="Vorherige Woche">${I.left}</button>
        <span class="small" style="min-width:150px;text-align:center">KW ${isoWeek(mon)} · ${esc(dShort(mon))}–${esc(dShort(addISO(mon, 6)))}</span>
        <button type="button" class="icon-btn" data-act="week" data-d="1" aria-label="Nächste Woche">${I.arrow}</button></div></div>
      ${rows}
      <p class="meta" style="margin-top:12px">Balken: tatsächlich gelernt · Strich: geplant (Dauer der Aufgaben, die in dieser Woche fällig sind).</p>
    </section>
    <section class="card s4">
      <div class="card-head"><h2 class="card-title">Wochenziel</h2></div>
      <p class="big">${esc(mins(total))}</p><p class="stat-label">von ${esc(mins(ziel))} in KW ${isoWeek(mon)}</p>
      <div style="margin:14px 0 18px">${bar(ziel ? total / ziel : 0, false)}</div>
      ${weekOffset === 0 ? timerHtml() : ""}
      <button type="button" class="btn" style="margin-top:12px" data-act="lz-manual">${I.plus}Zeit nachtragen</button>
      <p class="meta" style="margin-top:14px">Du arbeitest 80 %: Lernzeit fällt auf die Abende und den Dienstag. Budget ausserhalb der Schultage: ${esc(mins(bwl.data().semester.budgetNormalMin))} pro Woche, ab ${esc(dShort(bwl.data().semester.pruefungsphaseAb))} ${esc(mins(bwl.data().semester.budgetPruefungMin))}.</p>
      ${entries.length ? `<ul class="list" style="margin-top:12px">${entries.map(z => `<li class="row" style="min-height:44px"><span class="grow small">${esc(dShort(z.datum))} · ${esc(bwl.kurz(z.fach))}${z.notiz ? ` · ${esc(z.notiz)}` : ""}</span><span class="small">${esc(mins(z.minuten))}</span>${bwl.isPendingLernzeit(z.id) ? `<button type="button" class="star" data-act="lz-del" data-id="${esc(z.id)}" aria-label="Eintrag löschen">${I.trash}</button>` : ""}</li>`).join("")}</ul>` : ""}
    </section>`;
}

export const actions = {
  fach: (el, ctx) => { store.set("ui.fach", el.dataset.id); ctx.rerender(); },
  week: (el, ctx) => { weekOffset = Math.min(8, weekOffset + Number(el.dataset.d)); ctx.rerender(); },
};
