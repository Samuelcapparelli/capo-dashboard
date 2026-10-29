// Minimalistische SVG-Diagramme: eine Linie im Akzent, zurückhaltendes Raster, Fadenkreuz mit Tooltip.
// Touch: waagrecht über das Diagramm ziehen zeigt die Werte, senkrecht scrollt weiter die Seite.
import { esc, num, dMid } from "./util.js";

const observers = new WeakMap();

export function lineChart(el, { points, height = 220, fmtY = v => num(v), tip = p => `${dMid(p.x)}<br><b>${num(p.y)}</b>`, label = "" }) {
  const draw = () => {
    const W = Math.max(260, el.clientWidth), H = height;
    const padL = 44, padR = 10, padT = 12, padB = 26;
    const max = Math.max(1, ...points.map(p => p.y));
    const nice = niceMax(max), ticks = [0, nice / 2, nice];
    const x = i => padL + (i / Math.max(1, points.length - 1)) * (W - padL - padR);
    const y = v => padT + (1 - v / nice) * (H - padT - padB);
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join("");
    const area = `${path}L${x(points.length - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
    const xl = [0, Math.floor((points.length - 1) / 2), points.length - 1];
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      <defs><linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity="0.16"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map(t => `<line class="grid-line" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text class="axis-label" x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${esc(fmtY(t))}</text>`).join("")}
      ${xl.map((i, k) => `<text class="axis-label" x="${x(i)}" y="${H - 6}" text-anchor="${k === 0 ? "start" : k === 2 ? "end" : "middle"}">${esc(dMid(points[i].x))}</text>`).join("")}
      <path class="area" d="${area}"/>
      <path class="line" d="${path}"/>
      <line class="cross" x1="0" x2="0" y1="${padT}" y2="${H - padB}" visibility="hidden"/>
      <circle class="dot" r="5" visibility="hidden"/>
    </svg><div class="tip"></div>`;
    const svgEl = el.querySelector("svg"), cross = el.querySelector(".cross"), dot = el.querySelector(".dot"), tipEl = el.querySelector(".tip");
    let hideT = null;
    const show = ev => {
      const r = svgEl.getBoundingClientRect(), sx = (ev.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(points.length - 1, Math.round(((sx - padL) / (W - padL - padR)) * (points.length - 1))));
      const px = x(i), py = y(points[i].y);
      cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
      dot.setAttribute("cx", px); dot.setAttribute("cy", py); dot.setAttribute("visibility", "visible");
      tipEl.innerHTML = tip(points[i]);
      tipEl.style.left = `${Math.max(60, Math.min(r.width - 60, px * (r.width / W)))}px`;
      tipEl.style.top = `${py * (r.height / H)}px`;
      tipEl.classList.add("on");
      clearTimeout(hideT);
    };
    const hide = (delay = 0) => { clearTimeout(hideT); hideT = setTimeout(() => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tipEl.classList.remove("on"); }, delay); };
    svgEl.addEventListener("pointermove", show);
    svgEl.addEventListener("pointerdown", show);
    svgEl.addEventListener("pointerleave", () => hide(0));
    svgEl.addEventListener("pointerup", e => { if (e.pointerType !== "mouse") hide(1600); });
  };
  draw();
  if (!observers.has(el) && "ResizeObserver" in window) {
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; draw(); } });
    ro.observe(el); observers.set(el, ro);
  }
}

export function sparkline(el, values, { height = 56 } = {}) {
  const W = Math.max(120, el.clientWidth), H = height, max = Math.max(1, ...values);
  const x = i => (i / Math.max(1, values.length - 1)) * (W - 4) + 2, y = v => 4 + (1 - v / max) * (H - 8);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(values.length - 1)}" cy="${y(values[values.length - 1])}" r="3.5" fill="var(--accent)"/></svg>`;
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
