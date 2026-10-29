// Theme vor dem ersten Zeichnen setzen, damit nichts aufblitzt (eigene Datei wegen Content-Security-Policy ohne Inline-Skripte)
try {
  const t = JSON.parse(localStorage.getItem("dash.theme"));
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
} catch (e) { /* Standard: wie System */ }
