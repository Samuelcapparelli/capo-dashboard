// Schlanker Supabase-Client ohne Bibliothek: Anmeldung mit E-Mail und Passwort, Token erneuern, Edge Functions aufrufen.
// Die Sitzung liegt im Speicher der Home-Bildschirm-App (localStorage), damit das iPad angemeldet bleibt.
import { SUPABASE } from "./config.js";
import * as store from "./store.js";

const KEY = "auth";
export const session = () => store.get(KEY, null);
export const signedIn = () => !!session()?.refresh_token;
export const email = () => session()?.user?.email || "";
export const userId = () => session()?.user?.id || "";

async function authFetch(path, body) {
  const r = await fetch(`${SUPABASE.url}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE.key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(germanAuthError(data));
  return data;
}
function germanAuthError(d) {
  const m = String(d.msg || d.error_description || d.message || d.error || "Unbekannter Fehler");
  if (/invalid login credentials/i.test(m)) return "E-Mail oder Passwort falsch";
  if (/email not confirmed/i.test(m)) return "E-Mail noch nicht bestätigt: Link in der Bestätigungsmail öffnen";
  if (/signups? not allowed|signup.*disabled/i.test(m)) return "Neue Konten sind gesperrt";
  if (/already registered/i.test(m)) return "Für diese E-Mail gibt es schon ein Konto: anmelden";
  if (/password.*(6|characters)/i.test(m)) return "Passwort zu kurz (mindestens 6 Zeichen, besser 12+)";
  if (/rate limit/i.test(m)) return "Zu viele Versuche, bitte später nochmals";
  return m;
}
const keep = s => { store.set(KEY, { ...s, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) }); return session(); };

export async function signIn(mail, password) {
  return keep(await authFetch("token?grant_type=password", { email: mail.trim(), password }));
}
export async function signUp(mail, password) {
  const d = await authFetch("signup", { email: mail.trim(), password });
  if (d.access_token) keep(d);
  return d; // ohne access_token: Bestätigungsmail wurde verschickt
}
export function signOut() {
  const s = session();
  store.set(KEY, null);
  if (s?.access_token) fetch(`${SUPABASE.url}/auth/v1/logout`, { method: "POST", headers: { apikey: SUPABASE.key, Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
}

let refreshing = null;
async function accessToken() {
  const s = session();
  if (!s?.refresh_token) throw new Error("Nicht angemeldet");
  if (s.expires_at - Date.now() / 1000 > 60) return s.access_token;
  refreshing ||= authFetch("token?grant_type=refresh_token", { refresh_token: s.refresh_token })
    .then(keep)
    .catch(e => { if (/invalid|not found|revoked/i.test(e.message)) store.set(KEY, null); throw e; })
    .finally(() => { refreshing = null; });
  return (await refreshing).access_token;
}

// Tabellen über PostgREST (Zugriff nur auf eigene Zeilen, siehe RLS in supabase/schema.sql)
export async function rest(path, { method = "GET", body, prefer } = {}) {
  const token = await accessToken();
  const r = await fetch(`${SUPABASE.url}/rest/v1/${path}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { apikey: SUPABASE.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
  });
  if (r.status === 401) { store.set(KEY, null); throw new Error("Sitzung abgelaufen, bitte neu anmelden"); }
  if (!r.ok) throw new Error(`Datenbank ${r.status}`);
  return r.status === 204 || r.status === 201 && prefer?.includes("minimal") ? null : r.json().catch(() => null);
}

// Edge Function aufrufen; Fehlertext der Function wird durchgereicht
export async function fn(name, body = {}, timeout = 25000) {
  const token = await accessToken();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`${SUPABASE.url}/functions/v1/${name}`, {
      method: "POST", signal: ctl.signal,
      headers: { apikey: SUPABASE.key, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) { store.set(KEY, null); throw new Error("Sitzung abgelaufen, bitte neu anmelden"); }
    if (!r.ok || data.ok === false) throw new Error(data.error || data.message || `HTTP ${r.status}`);
    return data;
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Zeitüberschreitung");
    throw e;
  } finally { clearTimeout(t); }
}
