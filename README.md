# J.A.R.V.I.S. — AI Chrome Interface

Futuristisches KI-Kontrollzentrum im Stil eines HUD: holografischer KI-Kern, Sprachsteuerung,
integrierter Browser, Systemmonitor und Informationsmodule. React · TypeScript · Tailwind · Framer Motion · Recharts · Web Speech API.

## Schnellstart

```bash
npm install
npm run dev            # Frontend auf http://localhost:5173
npm test               # Unit-Tests (Befehlserkennung, ICS, lokale KI-Fähigkeiten)
```

Optional das KI-Backend (zweites Terminal):

```bash
cd server && npm install && cd ..
ANTHROPIC_API_KEY=… npm run dev:server   # ohne Key läuft es im Echo-Modus
```

Dann in der Oberfläche **Einstellungen → KI-Anbieter → Backend-Server** wählen.

### Als Chrome-Extension

```bash
npm run build:extension
```

`chrome://extensions` → Entwicklermodus → **Entpackte Erweiterung laden** → `extension/dist`.
J.A.R.V.I.S. ersetzt dann den neuen Tab (Strg+Shift+J öffnet ihn ebenfalls). Als Extension werden
echte CPU-/RAM-Werte (`chrome.system.*`), echte Downloads und echte Chrome-Tabs (inkl. Inkognito) genutzt.

## Funktionen

| Bereich | Was funktioniert |
|---|---|
| **KI-Kern** | Canvas + SVG, 5 Zustände (Idle / Listening / Thinking / Speaking / Error), echte Mikrofon-Pegel, wortsynchrone Sprachwelle. Klick = Sprechen. Pausiert im Hintergrund-Tab. |
| **Kommunikation** | Chatverlauf (persistiert), Zeitstempel, Vorlesen, Einzel-Löschen, Zurücksetzen, Abbrechen, Vorschläge |
| **Sprache** | Push-to-Talk, „Hey Jarvis“-Aktivierungswort, Text-to-Speech mit Stimmauswahl, DE/EN |
| **Browser** | Tabs, Zurück/Vor, Neu laden, Adress-/Suchleiste, Lesezeichen, Verlauf, Downloads, privater Modus (kein Verlauf), eingebaute Suche (Wikipedia-API), „extern öffnen“ |
| **Systemmonitor** | CPU, RAM, Netzwerk, Verbindung, Latenz, Heap, Frame-Lag, Prozesse, KI-Last — jede Quelle als **LIVE / EST / DEMO** gekennzeichnet |
| **Informationen** | Uhr, Wetter (Open-Meteo, ohne Key), Kalender, Erinnerungen (mit Benachrichtigung + Sprachausgabe), Nachrichten (Demo), Aufgaben, Notizen — einzeln ein-/ausblendbar |
| **Ansichten** | Kommando · Browser · Fokus; Ultrawide = 4 Spalten, Laptop = 3, Tablet = gestapelt mit Schubladen |

### KI-Fähigkeiten

Erreichbar über die Leiste über dem Eingabefeld, per Sprache oder Text. Mit KI-Backend (Claude) arbeiten sie vollständig;
ohne Backend greift jeweils eine echte lokale Variante.

| Fähigkeit | Mit Backend (Claude) | Offline / ohne Backend |
|---|---|---|
| **Seite zusammenfassen** | Kernaussage + Stichpunkte | Extraktive Zusammenfassung (wichtigste Sätze) |
| **Seite übersetzen** | Übersetzung direkt im Chat | Übergabe an Google Übersetzer |
| **Seite analysieren** | Zweck, Zielgruppe, Tonalität, Glaubwürdigkeit, Tracking | Umfang, Lesezeit, Sprache, Schlüsselbegriffe, HTTPS |
| **Recherche** | Websuche mit Quellenangaben | Wikipedia-Zusammenfassung mit Quellen |
| **E-Mail-Assistent** | Vollständig formulierter Entwurf | Vorlage mit Empfänger und Betreff; beide → „In Mail-App öffnen“ |
| **Lesezeichen sortieren** | KI-Kategorien | Regelbasierte Kategorien |
| **Aufgabe zerlegen** (✨ an jeder Aufgabe) | Aufgabenspezifische Teilschritte | Allgemeine Schrittvorlage |
| **Datei analysieren** (Text, CSV, JSON, PDF, Bilder; auch per Drag & Drop) | Inhaltliche Analyse, auch PDF/Bild | Statistik, Schlüsselbegriffe, Kernsätze, CSV-Spalten |

Seiteninhalte liest J.A.R.V.I.S. als Extension direkt, im Web-Modus über `GET /api/page` des Backends
(nur öffentliche Adressen; interne IPs, `file://` und Zugangsdaten in URLs werden abgewiesen).

**Kalender:** Import und Export im ICS-Format (Google Kalender, Outlook, Apple Kalender) über die Knöpfe im Kalendermodul.

**Routinen (automatisierte Browseraktionen):** In den Einstellungen konfigurierbar. „Starte Morgenroutine“ öffnet die
hinterlegten Seiten als Tabs und liest ein Briefing aus Wetter, Terminen, Aufgaben und Erinnerungen vor.
Vorkonfiguriert: Morgenroutine, Arbeitsbeginn, Feierabend.

### Sprachbefehle (Beispiele)

„Hey Jarvis“ · „Öffne YouTube“ · „Suche nach künstlicher Intelligenz“ · „Wie ist das Wetter?“ ·
„Zeige mir meine Termine“ · „Öffne einen neuen Tab“ · „Öffne einen privaten Tab“ · „Schließe den aktuellen Tab“ ·
„Neue Aufgabe: …“ · „Notiz: …“ · „Erinnere mich in 10 Minuten an …“ · „Fokusmodus“ · „Zurück“ · „Neu laden“ ·
„Fasse diese Seite zusammen“ · „Übersetze die Seite ins Englische“ · „Analysiere die Seite“ · „Recherchiere über …“ ·
„Schreibe eine E-Mail an … wegen …“ · „Sortiere meine Lesezeichen“ · „Zerlege die Aufgabe …“ · „Exportiere den Kalender“ · „Starte Morgenroutine“

### Tastenkürzel

`/` Eingabe · `Strg+Leertaste` Mikrofon · `Alt+1/2/3` Ansichten · `Strg+,` Einstellungen · `Esc` Abbrechen

## Architektur

```
src/
  types.ts                     Domänentypen, inkl. JarvisAction (UI-Automationsbefehle)
  services/
    ai/                        AIProvider-Interface + DemoProvider (offline) + BackendProvider (HTTP)
    skills/                    KI-Fähigkeiten: runSkill() → Backend oder lokale Implementierung
    commands/intentParser.ts   Deterministische Sprach-/Textbefehle → JarvisAction[]
    speech/                    Web Speech API (Erkennung + Synthese)
    browser/host.ts            HostAdapter: WebHost | ExtensionHost (chrome.tabs/downloads/system)
    system/metrics.ts          Metriken mit Quellenkennzeichnung
    data/                      Wetter (Open-Meteo), ICS-Import/Export, Demo-Daten
  state/                       Settings, Workspace (Kalender/Aufgaben/…), Browser-Tabs — localStorage
  hooks/useAssistant.ts        Orchestrierung: Befehl → KI → Aktionen → Sprachausgabe → Kernzustand
  components/                  core · chat · browser · system · info · layout · settings · ui
server/                        Modellunabhängiges Backend (Node), Provider in server/providers/
extension/                     Manifest V3 + Service Worker
```

**Ablauf einer Anfrage:** Eingabe → `intentParser` (sofortige, verlässliche Browsersteuerung) →
sonst `AIProvider.chat()` mit Kontext (Termine, Aufgaben, Wetter, aktiver Tab) → Antwort + optionale
`actions` → `execute()` in `App.tsx` → Text-to-Speech.

**Backend-Vertrag:** `POST /api/chat { messages, context } → { text, actions, provider }`.
Das Modell kann UI-Aktionen über eine `ACTIONS: [...]`-Zeile anstoßen; das Backend prüft sie gegen eine Allowlist
(nur `http(s)`-Navigation). API-Schlüssel verlassen nie das Backend.

**Neues Modell anbinden:** Datei in `server/providers/` mit `{ id, chat({ system, messages, signal }) }` anlegen
und in `server/index.mjs` auswählen (`JARVIS_PROVIDER`). Standard ist Claude (`claude-opus-5-5`, Effort `low`
für schnelle Sprachantworten; `JARVIS_MODEL` / `JARVIS_EFFORT` überschreiben).

**Backend-Fähigkeiten:** `POST /api/skill { skill, input } → { text, sources?, data? }`, definiert in `server/skills.mjs`.
Eine neue Fähigkeit = ein Eintrag dort + ein `SkillId` im Frontend + (optional) eine lokale Variante in `src/services/skills/local.ts`.

**Weitere Erweiterungspunkte:** echte Postfach-/Kalender-Synchronisation (OAuth-Provider im Backend, Workspace-State ersetzen),
Electron/Tauri (neuen `HostAdapter` implementieren).

## Bekannte Grenzen

- Viele Websites (YouTube, Google, …) verbieten das Einbetten per `X-Frame-Options`. Das Panel zeigt dann
  „Extern öffnen“ bzw. als Extension „Als Chrome-Tab öffnen“.
- Echte CPU/RAM-Werte gibt es nur als Extension; im Web-Modus sind sie als DEMO/EST markiert.
- Spracherkennung benötigt Chrome/Edge und Mikrofonfreigabe.
- Nachrichten sind Demo-Schlagzeilen (keine schlüsselfreie, CORS-fähige News-API verfügbar).
- Der E-Mail-Assistent erstellt Entwürfe und öffnet sie im Mailprogramm; er liest oder versendet keine Mails selbst.
- Web-Recherche über das ganze Web und die inhaltliche PDF-/Bildanalyse benötigen den Claude-Provider (`ANTHROPIC_API_KEY`).
- Die Extension fordert Lesezugriff auf alle Seiten (`<all_urls>`) an — nötig, um Seiten zusammenzufassen.

## Umgebungsvariablen (Backend)

| Variable | Standard |
|---|---|
| `ANTHROPIC_API_KEY` | – (ohne → Echo-Modus) |
| `JARVIS_PROVIDER` | `claude` wenn Key gesetzt, sonst `echo` |
| `JARVIS_MODEL` | `claude-opus-5-5` |
| `JARVIS_EFFORT` | `low` |
| `PORT` | `8787` |
| `JARVIS_ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` (+ alle `chrome-extension://`) |
