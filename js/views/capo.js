// Ansicht «CAPO»: Verkauf, Besucher, offene Bestellungen, Lager. Live über «wix-stats», ohne Anmeldung Demodaten.
import { esc, num, dMid, dShort, dFull, timeOf, diffDays, todayISO } from "../util.js";
import { card, errorBox, I } from "../ui.js";
import { lineChart } from "../charts.js";

const partError = (what, msg) => `<div class="error-box" role="alert"><p class="t1">${esc(what)} nicht verfügbar</p><p class="t2">${esc(msg)}</p></div>`;

export function render(ctx) {
  if (!ctx.capo.ok) return `<div class="grid">${card({ cls: "s12", title: "CAPO", body: errorBox("Shop-Daten (Wix)", ctx.capo.error) })}</div>`;
  const demo = !ctx.sources.capo.live;
  const { days, offen, lager, besucher, letzte, fehler = {}, lagerInfo, stale, at } = ctx.capo.data;
  const sumU = (a, b) => days.slice(days.length - a, days.length - b || undefined).reduce((s, d) => s + d.umsatz, 0);
  const sumN = (a, b) => days.slice(days.length - a, days.length - b || undefined).reduce((s, d) => s + d.bestellungen, 0);
  const u30 = sumU(30), n30 = sumN(30), prev30 = sumU(60, 30);
  const avg = n30 ? u30 / n30 : 0;
  const delta = prev30 ? (u30 - prev30) / prev30 : null;
  const kpi = (v, l, d = "") => `<div class="kpi"><p class="big">${v}</p><p class="stat-label">${l}</p>${d}</div>`;
  const notice = demo
    ? `<div class="notice neutral" style="margin-bottom:16px;align-items:center"><div style="flex:1"><b>Demodaten.</b> Für Live-Zahlen aus Wix (capoclo.com) anmelden.</div><button type="button" class="btn primary" data-act="login">${I.user}Anmelden</button></div>`
    : stale ? `<div class="notice" style="margin-bottom:16px"><div><b>Offline.</b> Letzter Stand von ${esc(timeOf(at))}.</div></div>`
    : `<p class="meta" style="margin:0 2px 12px">Live aus Wix · capoclo.com · Stand ${esc(timeOf(at))}</p>`;
  const verkauf = fehler.verkauf || !days.length ? partError("Verkaufszahlen", fehler.verkauf || "Keine Daten") : `<div class="kpis">
      ${kpi(num(sumU(1)), "CHF Umsatz heute")}
      ${kpi(num(sumU(7)), "CHF Umsatz 7 Tage")}
      ${kpi(num(u30), "CHF Umsatz 30 Tage", delta != null ? `<p class="delta ${delta >= 0 ? "up" : "down"}">${num(Math.abs(delta * 100))} % zu den 30 Tagen davor</p>` : "")}
      ${kpi(num(n30), "Bestellungen 30 Tage", `<p class="delta">${sumN(1)} heute · ${sumN(7)} in 7 Tagen</p>`)}
      ${kpi(n30 ? num(avg, 2) : "–", "CHF Ø Warenkorb 30 Tage")}
    </div>
    ${!n30 && letzte ? `<p class="meta" style="margin-top:14px">Letzte Bestellung: #${esc(letzte.nr)} vom ${esc(dFull(letzte.datum))} (CHF ${num(letzte.betrag, 2)}), vor ${diffDays(letzte.datum, todayISO())} Tagen.</p>` : ""}`;
  const bs = besucher;
  const besucherBody = fehler.besucher || !bs ? partError("Besucherzahlen", fehler.besucher || "Keine Daten") : `<div class="kpis" style="grid-template-columns:1fr">
      ${kpi(num(bs.heute), "Besucher heute")}
      ${kpi(num(bs.d7), "Besucher 7 Tage")}
      ${kpi(num(bs.d30), "Besucher 30 Tage", `<p class="delta">${num(bs.sessions30)} Sessions${bs.d30 ? ` · Conversion ${num(n30 / bs.d30 * 100, 1)} %` : ""}</p>`)}
    </div>
    <p class="meta" style="margin-top:14px">Quelle: Wix Analytics. Besucher = eindeutige Personen pro Zeitraum.</p>`;
  const offenBody = fehler.offen ? partError("Offene Bestellungen", fehler.offen) : offen.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Nr.</th><th>Artikel</th><th class="num">Betrag CHF</th><th class="num">Alter</th><th>Status</th></tr></thead>
      <tbody>${offen.map(o => `<tr><td>#${esc(o.nr)}</td><td>${esc(o.artikel.join(", "))}<br><span class="meta">${esc(dShort(o.datum))} · ${esc(o.zeit)}</span></td><td class="num">${num(o.betrag, 2)}</td>
        <td class="num ${o.alter >= 5 ? "accent" : ""}">${o.alter === 0 ? "heute" : `${o.alter} T.`}</td><td><span class="pill ${o.alter >= 5 ? "warn" : ""}">${esc(o.status)}</span></td></tr>`).join("")}</tbody>
    </table></div>` : '<p class="empty">Keine offenen Bestellungen. Alles versandt.</p>';
  const lagerBody = fehler.lager ? partError("Lagerbestand", fehler.lager) : `${lager.length ? `<ul class="list">${lager.map(l => `<li class="row"><div class="grow"><p class="t1">${esc(l.produkt)}</p><p class="t2">${esc(l.variante)}</p></div>
      <span class="pill ${l.bestand === 0 ? "hot" : "warn"}">${l.bestand === 0 ? "ausverkauft" : `noch ${l.bestand}`}</span></li>`).join("")}</ul>` : '<p class="empty">Alles an Lager.</p>'}
      <p class="meta" style="margin-top:10px">${lagerInfo ? `${lagerInfo.produkte} Produkte geprüft · Warnung ab ${lagerInfo.schwelle} Stück pro Variante.` : ""}</p>`;
  return `${notice}
  <div class="grid">${card({ cls: "s12", title: "Verkauf", demo, body: verkauf })}</div>
  <div class="grid">
    ${card({ cls: "s8", title: "Umsatz pro Tag · 30 Tage", demo, body: days.length ? '<div class="chart" id="chart-umsatz"></div>' : partError("Verlauf", fehler.verkauf || "Keine Daten") })}
    ${card({ cls: "s4 stretch", title: "Besucher", demo, body: besucherBody })}
  </div>
  <div class="grid">
    ${card({ cls: "s8", title: `Offene Bestellungen · ${fehler.offen ? "?" : offen.length}`, demo, body: offenBody })}
    ${card({ cls: "s4 stretch", title: "Lagerbestand", demo, body: lagerBody })}
  </div>`;
}

export function mount(root, ctx) {
  const el = root.querySelector("#chart-umsatz");
  if (!el || !ctx.capo.ok || !ctx.capo.data.days.length) return;
  const days = ctx.capo.data.days.slice(-30);
  lineChart(el, {
    points: days.map(d => ({ x: d.datum, y: d.umsatz, n: d.bestellungen, v: d.besucher })),
    fmtY: v => num(v), label: "Umsatz pro Tag der letzten 30 Tage in CHF",
    tip: p => `${dMid(p.x)}<br><b>CHF ${num(p.y)}</b> · ${p.n} Best.${p.v != null ? ` · ${p.v} Besucher` : ""}`,
  });
}
