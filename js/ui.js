// UI-Bausteine: Icons, Sheet, Toast, Karten-Gerüst, Fehlerzustand
import { esc } from "./util.js";

const svg = (d, extra = "") => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
export const I = {
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  auto: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  arrow: svg('<path d="M9 6l6 6-6 6"/>'),
  left: svg('<path d="M15 6l-6 6 6 6"/>'),
  chev: svg('<path d="M6 9l6 6 6-6"/>', 'class="chev"'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-6.5"/></svg>',
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" stroke-linejoin="round"/>'),
  play: svg('<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>'),
  stop: svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>'),
  user: svg('<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>'),
  userOn: svg('<circle cx="12" cy="8.5" r="3.8" fill="currentColor"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill="currentColor"/>'),
  trash: svg('<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l.8 12.5a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5L17.5 7M9 7V4.5h6V7"/>'),
  wx: {
    sun: svg('<circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4"/>'),
    cloudsun: svg('<path d="M8 4.5v1.2M3.8 6.3l.9.9M2.5 10.5h1.2M12.2 6.3l-.9.9"/><path d="M5.6 11.6a3.5 3.5 0 0 1 6-3.2"/><path d="M8 19.5h9.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.2A3 3 0 0 0 8 19.5z"/>'),
    cloud: svg('<path d="M7 18.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 18.5z"/>'),
    fog: svg('<path d="M4 10h16M3 14h18M6 18h12M7 6h10"/>'),
    rain: svg('<path d="M7 14.5h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 14.5z"/><path d="M8 17.5l-1 3M12 17.5l-1 3M16 17.5l-1 3"/>'),
    snow: svg('<path d="M7 14h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 14z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 21.5h.01M14 21.5h.01"/>'),
    storm: svg('<path d="M7 14h10.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.4A3.3 3.3 0 0 0 7 14z"/><path d="M12.5 15.5l-2 3.5h3l-2 3.5"/>'),
  },
};

export function card({ cls = "", title = "", demo = false, link = null, body = "", head = "", id = "" }) {
  return `<section class="card ${cls}"${id ? ` id="${id}"` : ""}>
    <div class="card-head">
      <h2 class="card-title">${esc(title)}${demo ? ' <span class="demo">Demo</span>' : ""}</h2>
      ${head}${link ? `<button type="button" class="card-link" data-go="${link}">Alle${I.arrow}</button>` : ""}
    </div>
    ${body}
  </section>`;
}

export const errorBox = (what, err) => `<div class="error-box" role="alert">
  <p class="t1">${esc(what)} nicht erreichbar</p>
  <p class="t2">${esc(err?.message || err || "Unbekannter Fehler")}. Die anderen Module laufen weiter.</p>
  <button type="button" class="btn" data-act="retry">${I.refresh}Erneut versuchen</button>
</div>`;

/* ---------- Sheet ---------- */
const $ = id => document.getElementById(id);
let lastFocus = null, onCloseFn = null;
export function openSheet(title, html, onClose) {
  const sheet = $("sheet"), bd = $("sheet-backdrop");
  lastFocus = document.activeElement;
  onCloseFn = onClose || null;
  $("sheet-title").textContent = title;
  $("sheet-body").innerHTML = html;
  sheet.hidden = false; bd.hidden = false;
  requestAnimationFrame(() => { sheet.classList.add("on"); bd.classList.add("on"); });
  const first = sheet.querySelector("input, select, textarea, button:not([data-close])");
  setTimeout(() => first?.focus({ preventScroll: true }), 330);
  return $("sheet-body");
}
export function closeSheet() {
  const sheet = $("sheet"), bd = $("sheet-backdrop");
  if (sheet.hidden) return;
  sheet.classList.remove("on"); bd.classList.remove("on");
  setTimeout(() => { sheet.hidden = true; bd.hidden = true; $("sheet-body").innerHTML = ""; }, 320);
  lastFocus?.focus?.({ preventScroll: true });
  const fn = onCloseFn; onCloseFn = null; fn?.();
}
export function initSheet() {
  $("sheet").querySelector("[data-close]").innerHTML = I.close;
  $("sheet").addEventListener("click", e => { if (e.target.closest("[data-close]")) closeSheet(); });
  $("sheet-backdrop").addEventListener("click", closeSheet);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
}

/* ---------- Toast mit «Rückgängig» ---------- */
let toastTimer = null;
export function toast(msg, undo) {
  const t = $("toast");
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button">Rückgängig</button>' : ""}`;
  t.hidden = false;
  requestAnimationFrame(() => t.classList.add("on"));
  if (undo) t.querySelector("button").onclick = () => { undo(); hide(); };
  clearTimeout(toastTimer);
  const hide = () => { t.classList.remove("on"); setTimeout(() => { t.hidden = true; }, 260); };
  toastTimer = setTimeout(hide, undo ? 5000 : 2600);
}

export const ampel = (level, label) => {
  const txt = { rot: "Risiko", gelb: "Achtung", gruen: "Auf Kurs" }[level];
  return `<span class="amp ${level}"><i aria-hidden="true"></i>${esc(label || txt)}</span>`;
};
export const bar = (frac, hot = false, target = null) => `<div class="bar${hot ? " hot" : ""}" role="img" aria-label="${Math.round(frac * 100)} Prozent">
  <i style="width:${Math.max(0, Math.min(100, frac * 100))}%"></i>${target != null ? `<span class="target" style="left:${Math.max(0, Math.min(100, target * 100))}%"></span>` : ""}</div>`;
export const source = q => q ? `<p class="source">${esc(q.datei)}${q.eintrag ? ` · ${esc(q.eintrag)}` : ""}</p>` : "";
