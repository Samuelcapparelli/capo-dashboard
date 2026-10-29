// Ansicht «Mails»: nur wichtige Mails (Filter nach Absender und Stichwort, editierbar)
import * as store from "../store.js";
import { esc, timeOf, dateOfTs, todayISO, dShort } from "../util.js";
import { card, I } from "../ui.js";
import { DEFAULT_FILTER } from "../data.js";
import { importantMails, mailFilter } from "./shared.js";

export function render(ctx) {
  const mails = importantMails(), f = mailFilter(), today = todayISO();
  const unread = mails.filter(m => !m.read).length;
  const list = mails.map(m => {
    const id = `mail-${m.id}`, d = dateOfTs(m.ts);
    return `<li class="mail${m.read ? " read" : ""}">
      <span class="dot" aria-hidden="true"></span>
      <div class="grow" style="flex:1;min-width:0">
        <button type="button" class="disclose" data-act="mail-open" data-id="${esc(m.id)}" aria-expanded="false" aria-controls="${id}" style="align-items:flex-start;min-height:0">
          <span style="flex:1;min-width:0"><span class="from clip" style="display:block">${esc(m.from)}</span><span class="subj clip" style="display:block">${esc(m.subj)}</span></span>
          <span class="time">${d === today ? esc(timeOf(m.ts)) : esc(dShort(d))}</span>
        </button>
        <div class="more" id="${id}"><div><p class="prev">${esc(m.prev)}</p><p class="source" style="margin-top:4px">${esc(m.addr)} · ${esc(m.rule)}</p></div></div>
      </div>
    </li>`;
  }).join("");
  const chips = (kind, arr) => `<div class="chips">${arr.map(v => `<span class="chip">${esc(v)}<button type="button" data-act="filter-del" data-kind="${kind}" data-v="${esc(v)}" aria-label="${esc(v)} entfernen">${I.close}</button></span>`).join("")}</div>
    <form class="toolbar" data-form="filter-add" data-kind="${kind}" style="margin-top:10px"><input class="input" name="v" placeholder="${kind === "absender" ? "Absender oder Domain" : "Stichwort"}" autocomplete="off" autocapitalize="none" enterkeyhint="done" style="flex:1;min-width:0"><button class="btn" type="submit" aria-label="Hinzufügen" style="padding:0 14px">${I.plus}</button></form>`;
  return `${ctx.sources.mails.live ? "" : '<div class="notice neutral" style="margin-bottom:16px"><div><b>Demodaten.</b> In Phase 2 liest das Backend dein GMX-Postfach per IMAP (App-Passwort nur im Backend). Die Filter unten gelten dann direkt.</div></div>'}
  <div class="grid">
    ${card({ cls: "s8", title: `Wichtige Mails · ${unread} ungelesen`, demo: !ctx.sources.mails.live, head: unread ? '<button type="button" class="card-link" data-act="mail-allread">Alle gelesen</button>' : "",
      body: mails.length ? `<ul class="list">${list}</ul>` : '<p class="empty">Keine wichtigen Mails.</p>' })}
    <div class="s4" style="display:grid;gap:var(--gap)">
      ${card({ title: "Filter · Absender", body: chips("absender", f.absender) })}
      ${card({ title: "Filter · Stichwörter", body: chips("stichwoerter", f.stichwoerter) + '<button type="button" class="btn" style="margin-top:14px" data-act="filter-reset">Standard wiederherstellen</button>' })}
      ${card({ title: "Benachrichtigung", body: '<p class="small muted">Phase 2: Push bei neuer wichtiger Mail. Auf dem iPad (ab iPadOS 16.4) nur, wenn das Dashboard über «Zum Home-Bildschirm» installiert ist. Alternative: ntfy-App.</p>' })}
    </div>
  </div>`;
}

export const actions = {
  "mail-open": (el) => {
    const read = new Set(store.get("mail.read", []));
    if (!read.has(el.dataset.id)) { read.add(el.dataset.id); store.set("mail.read", [...read]); el.closest(".mail").classList.add("read"); }
  },
  "mail-allread": (el, ctx) => { store.set("mail.read", importantMails().map(m => m.id)); ctx.rerender(); },
  "filter-del": (el, ctx) => {
    const f = mailFilter();
    store.set("mail.filter", { ...f, [el.dataset.kind]: f[el.dataset.kind].filter(v => v !== el.dataset.v) });
    ctx.rerender();
  },
  "filter-reset": (el, ctx) => { store.set("mail.filter", DEFAULT_FILTER); ctx.rerender(); },
};
export const forms = {
  "filter-add": (form, ctx) => {
    const v = form.v.value.trim(), kind = form.dataset.kind;
    if (!v) return;
    const f = mailFilter();
    if (!f[kind].some(x => x.toLowerCase() === v.toLowerCase())) store.set("mail.filter", { ...f, [kind]: [...f[kind], v] });
    ctx.rerender();
  },
};
