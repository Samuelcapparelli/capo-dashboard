// Ansicht «Kalender»: Tag, Woche, Monat. Live aus iCloud (nach Anmeldung), sonst Demo; Schultermine aus dem BWL-Sync.
import * as bwl from "../bwl.js";
import * as store from "../store.js";
import * as cal from "../cal.js";
import { esc, todayISO, addISO, mondayISO, pd, iso, dMid, dLong, isoWeek, MON_LONG, WD, toMin, zurichNow, timeOf } from "../util.js";
import { I, openSheet } from "../ui.js";

const FREE_DAY = 2; // Dienstag: frei (80 %), Schule, Lernen, CAPO
const H0 = 7, H1 = 22, PX = 46; // sichtbare Stunden und Pixel pro Stunde
let cursor = null, loadingFor = null;
export const currentDate = () => cursor || todayISO();

function range(mode) {
  if (mode === "monat") { const first = iso(new Date(pd(cursor).getFullYear(), pd(cursor).getMonth(), 1)); const s = mondayISO(first); return [s, addISO(s, 41)]; }
  if (mode === "woche") { const s = mondayISO(cursor); return [s, addISO(s, 6)]; }
  return [cursor, cursor];
}

export function render(ctx) {
  const today = todayISO();
  cursor ||= today;
  const mode = store.get("ui.calmode", "woche");
  const [from, to] = range(mode);
  // Ausserhalb des geladenen Fensters: im Hintergrund nachladen
  if (cal.isLive(ctx) && !cal.covers(ctx, from, to) && loadingFor !== cursor) { loadingFor = cursor; ctx.loadKal(cursor).finally(() => { loadingFor = null; }); }
  const ev = cal.eventsFor(ctx, from, to);
  const title = mode === "monat" ? `${MON_LONG[pd(cursor).getMonth()]} ${pd(cursor).getFullYear()}` : mode === "woche" ? `KW ${isoWeek(cursor)} · ${dMid(mondayISO(cursor))} – ${dMid(addISO(mondayISO(cursor), 6))}` : dLong(cursor);
  const body = mode === "monat" ? month(today, ev) : mode === "woche" ? week(today, ev) : day(today, ev);
  const live = cal.isLive(ctx), d = ctx.kal?.data;
  const status = !ctx.sources.kalender.live
    ? `<span class="demo">Arbeit, CAPO, Privat: Demo</span><button type="button" class="card-link" data-act="login">${I.user}Für iCloud anmelden</button>`
    : ctx.kal?.pending ? "<span>Lädt …</span>"
    : ctx.kal?.ok === false ? `<span class="accent">iCloud nicht erreichbar: ${esc(ctx.kal.error)}</span><button type="button" class="card-link" data-act="retry">${I.refresh}Erneut</button>`
    : live ? `<span>iCloud · ${d.stale ? "offline, " : ""}Stand ${esc(timeOf(d.at))}</span><button type="button" class="card-link" data-act="kal-map">Kalender zuordnen</button>`
    : "<span>Lädt …</span>";
  const fehler = live ? Object.entries(d.fehler || {}) : [];
  return `<div class="grid"><section class="card s12">
    <div class="toolbar" style="margin-bottom:16px">
      <p class="title">${esc(title)}</p>
      <div class="seg" role="group" aria-label="Ansicht">${[["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"]].map(([k, l]) => `<button type="button" data-act="calmode" data-m="${k}" aria-pressed="${mode === k}">${l}</button>`).join("")}</div>
      <button type="button" class="icon-btn" data-act="calnav" data-d="-1" aria-label="Zurück">${I.left}</button>
      <button type="button" class="btn" data-act="calnav" data-d="0">Heute</button>
      <button type="button" class="icon-btn" data-act="calnav" data-d="1" aria-label="Weiter">${I.arrow}</button>
      <button type="button" class="btn primary" data-act="todo-new" data-date="${esc(cursor)}">${I.plus}Aufgabe</button>
    </div>
    <div class="cal-legend" style="margin-bottom:14px;align-items:center">
      <span><i class="cdot studium"></i>Studium</span><span><i class="cdot arbeit"></i>Arbeit</span><span><i class="cdot capo"></i>CAPO</span><span><i class="cdot privat"></i>Privat</span>
      <span style="margin-left:auto;gap:10px">${status}</span>
    </div>
    ${fehler.length ? `<div class="notice" style="margin-bottom:14px"><div>${fehler.map(([k, m]) => `<b>${esc(k)}:</b> ${esc(m)}`).join("<br>")}</div></div>` : ""}
    ${body}
  </section></div>`;
}

const label = e => e.von ? `${e.von}${e.bis ? `–${e.bis}` : ""}` : e.zeitText || "ganztägig";
const kind = e => e.frist || e.pruefung ? "frist" : e.cal;

function week(today, ev) {
  const mon = mondayISO(cursor), days = [...Array(7)].map((_, i) => addISO(mon, i));
  const now = zurichNow();
  const hours = [...Array(H1 - H0 + 1)].map((_, i) => H0 + i);
  const head = days.map(d => {
    const free = pd(d).getDay() === FREE_DAY;
    return `<div class="wh${d === today ? " today" : ""}${free ? " free" : ""}">${WD[pd(d).getDay()]}<b>${pd(d).getDate()}</b>${free ? '<span class="freelabel">Frei · Schule · CAPO</span>' : ""}</div>`;
  }).join("");
  const allday = days.map(d => {
    const list = ev.filter(e => e.datum === d && !e.von);
    return `<div class="allday${pd(d).getDay() === FREE_DAY ? " free" : ""}">${list.map(e => `<span class="adev ${kind(e)}" title="${esc(e.titel)}">${esc(e.zeitText && !e.frist ? `${e.zeitText} · ` : "")}${esc(e.titel)}</span>`).join("")}</div>`;
  }).join("");
  const cols = days.map(d => {
    const list = ev.filter(e => e.datum === d && e.von);
    const top = t => (toMin(t) / 60 - H0) * PX;
    return `<div class="col${pd(d).getDay() === FREE_DAY ? " free" : ""}" style="height:${(H1 - H0) * PX}px">
      ${hours.slice(1).map(h => `<span class="hline" style="top:${(h - H0) * PX}px"></span>`).join("")}
      ${list.map(e => {
        const t = Math.max(0, Math.min((H1 - H0) * PX - 22, top(e.von)));
        const b = Math.min((H1 - H0) * PX, top(e.bis || e.von) + (e.bis ? 0 : 30));
        return `<div class="ev ${e.cal}" style="top:${t}px;height:${Math.max(22, b - t - 2)}px" title="${esc(e.titel)}${e.ort ? ` · ${esc(e.ort)}` : ""}"><b>${esc(e.titel)}</b>${esc(label(e))}</div>`;
      }).join("")}
      ${d === today && now.h >= H0 && now.h < H1 ? `<span class="nowbar" style="top:${(now.minutes / 60 - H0) * PX}px"></span>` : ""}
    </div>`;
  }).join("");
  return `<div class="table-wrap"><div class="week" style="min-width:760px">
    <div class="wh"></div>${head}
    <div class="allday"><span class="meta" style="font-size:11px">ganzt.</span></div>${allday}
    <div class="gutter" style="height:${(H1 - H0) * PX}px">${hours.slice(1, -1).map(h => `<span style="top:${(h - H0) * PX}px">${h}:00</span>`).join("")}</div>${cols}
  </div></div>
  <p class="meta" style="margin-top:12px">Termine vor 7 oder nach 22 Uhr stehen am Rand. Schultermine ohne genaue Uhrzeit («abends») stehen in der Zeile «ganzt.».</p>`;
}

function day(today, ev) {
  const list = ev.filter(e => e.datum === cursor);
  const free = pd(cursor).getDay() === FREE_DAY;
  const tasks = bwl.data() ? bwl.tasks().filter(t => t.faellig === cursor && t.st !== "skip" && !bwl.expired(t, today)) : [];
  return `${free ? '<p class="pill warn" style="margin-bottom:12px">Freier Tag · Schule, Lernen, CAPO</p>' : ""}
    <div class="grid" style="margin:0"><div class="s7">
      ${list.length ? `<ul class="timeline">${list.map(e => `<li class="${e.cal}"><p class="when">${esc(label(e))}</p><p class="what">${esc(e.titel)}</p>${e.ort ? `<p class="meta">${esc(e.ort)}</p>` : ""}</li>`).join("")}</ul>` : '<p class="empty">Keine Termine.</p>'}
    </div><div class="s5">
      <p class="kicker" style="margin-bottom:6px">Studium fällig an diesem Tag</p>
      ${tasks.length ? `<ul class="list">${tasks.map(t => `<li class="row"><div class="grow"><p class="t1">${esc(bwl.kurz(t.fach))}: ${esc(t.titel)}</p><p class="t2">${esc(bwl.ART_LABEL[t.art])}${t.st === "done" ? " · erledigt" : ""}</p></div></li>`).join("")}</ul>` : '<p class="empty">Nichts fällig.</p>'}
    </div></div>`;
}

function month(today, ev) {
  const first = new Date(pd(cursor).getFullYear(), pd(cursor).getMonth(), 1);
  const start = mondayISO(iso(first));
  const cells = [...Array(42)].map((_, i) => addISO(start, i));
  const m = first.getMonth();
  return `<div class="month">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map(d => `<div class="mh">${d}</div>`).join("")}
    ${cells.map(d => {
      const list = ev.filter(e => e.datum === d).sort((a, b) => (a.cal === "studium" ? -1 : 0) - (b.cal === "studium" ? -1 : 0));
      const out = pd(d).getMonth() !== m, free = pd(d).getDay() === FREE_DAY;
      return `<button type="button" class="mc${out ? " out" : ""}${d === today ? " today" : ""}${free && !out ? " free" : ""}" data-act="calday" data-d="${d}" aria-label="${esc(dLong(d))}, ${list.length} Termine">
        <span class="dn">${pd(d).getDate()}</span>
        ${list.slice(0, 3).map(e => `<span class="adev ${kind(e)}">${esc(e.titel)}</span>`).join("")}
        ${list.length > 3 ? `<span class="more-n">+${list.length - 3}</span>` : ""}
      </button>`;
    }).join("")}</div>`;
}

function mapSheet(ctx) {
  const ks = ctx.kal.data.kalender;
  openSheet("Kalender zuordnen", `<p class="small muted" style="margin-bottom:14px">So erscheinen deine iCloud-Kalender im Dashboard. «Ausblenden» zeigt einen Kalender nicht an.</p>
    <div class="form">${ks.map(k => `<div class="field"><span style="display:flex;align-items:center;gap:8px">${k.farbe ? `<i class="cdot" style="background:${esc(k.farbe)}"></i>` : ""}${esc(k.name)}${k.schreibbar ? "" : " · nur lesen"}</span>
      <div class="seg" role="radiogroup" style="flex-wrap:wrap">${Object.entries(cal.CATS).map(([c, l]) => `<button type="button" data-act="kal-set" data-id="${esc(k.id)}" data-cat="${c}" aria-pressed="${cal.catOf(k) === c}">${l}</button>`).join("")}</div></div>`).join("")}</div>`);
}

export const actions = {
  calmode: (el, ctx) => { store.set("ui.calmode", el.dataset.m); ctx.rerender(); },
  calnav: (el, ctx) => {
    const d = Number(el.dataset.d), mode = store.get("ui.calmode", "woche");
    if (d === 0) cursor = todayISO();
    else if (mode === "monat") { const x = pd(cursor); cursor = iso(new Date(x.getFullYear(), x.getMonth() + d, 1)); }
    else cursor = addISO(cursor, d * (mode === "woche" ? 7 : 1));
    ctx.rerender();
  },
  calday: (el, ctx) => { cursor = el.dataset.d; store.set("ui.calmode", "tag"); ctx.rerender(); },
  "kal-map": (el, ctx) => { if (cal.isLive(ctx)) mapSheet(ctx); },
  "kal-set": (el, ctx) => {
    cal.setCat(el.dataset.id, el.dataset.cat);
    el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b === el));
    ctx.rerender();
  },
};
