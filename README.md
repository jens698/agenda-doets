# 📅 Mijn Werkagenda

Een overzichtelijke, mooie werkagenda als web-app (PWA). Geen account, geen
server nodig — alles draait in je browser en wordt lokaal opgeslagen.

## ✨ Functies

- **Taken beheren** – toevoegen, bewerken, afvinken en verwijderen
- **Prioriteiten** – laag / normaal / hoog (met kleurcodering)
- **Categorieën** – Werk, Vergadering, Persoonlijk, Urgent
- **Weergaves** – Vandaag, Deze week, Alle taken, Afgerond
- **Datum & tijd** – plan taken met deadline; "te laat"-melding
- **⏱️ Focus-timer** – Pomodoro (25 min) + korte/lange pauze
- **🔔 Herinneringen** – browsermelding op het ingestelde tijdstip
- **🌙 Licht & donker thema**
- **🔍 Zoeken** door al je taken
- **Statistieken** – openstaand, te laat, afgerond en voortgang
- **Offline** – werkt zonder internet (service worker)
- **Installeerbaar** als app op je desktop

## 🚀 Starten

Open `index.html` rechtstreeks in je browser, of start een lokale server
voor de volledige PWA-functionaliteit (notificaties + offline):

```bash
# Python 3
python3 -m http.server 8080
# daarna: http://localhost:8080
```

## 🖥️ Installeren op je desktop

1. Open de app in Chrome of Edge.
2. Klik op het **installatie-icoon** in de adresbalk (of menu → "App installeren").
3. De agenda opent voortaan als losstaande app in je startmenu/dock.

## ⌨️ Sneltoetsen

- `N` – nieuwe taak
- `Esc` – venster sluiten

## 💾 Je data

Alles wordt opgeslagen in `localStorage` van je browser. Wis je
browsergegevens niet als je je taken wilt behouden.
