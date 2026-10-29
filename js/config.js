// Öffentliche Projektdaten von Supabase (der publishable Key ist für den Browser gedacht; Zugriff schützen Login und RLS).
// Geheimnisse (Wix-Key, iCloud, GMX) liegen nur in den Supabase-Secrets, nie hier.
// Module ein- und ausschalten. Mails sind vorerst ausgelassen (Entscheid vom 29.10.2026); true schaltet Tab und Karte wieder ein.
export const MODULES = { mails: false };

export const SUPABASE = {
  url: "https://kfjbbsmyfmbidvwjhlfa.supabase.co",
  key: "sb_publishable_Ch5ZpOX42sJFsmCPr7HDbQ_ZvTxIZqz",
};
