#!/bin/bash
# J.A.R.V.I.S. auf diesem Mac starten — im Finder doppelklicken.
# Beim ersten Start: fragt nach dem Anthropic-API-Schlüssel, installiert alles, baut die App.
# Danach: startet in wenigen Sekunden und öffnet http://localhost:8787. Fenster offen lassen; schließen = beenden.

cd "$(dirname "$0")" || exit 1
clear
printf '\n  \033[36mJ.A.R.V.I.S.\033[0m  ·  Control Interface\n\n'

pause_exit() { echo; read -n 1 -s -r -p "  Taste drücken zum Schließen …"; echo; exit 1; }

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js ist nicht installiert. Ich öffne die Download-Seite."
  echo "  Bitte die LTS-Version (macOS-Installer) installieren und danach erneut doppelklicken."
  open "https://nodejs.org/de/download"
  pause_exit
fi
if [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  echo "  Node.js $(node -v) ist zu alt — bitte Version 22 oder neuer installieren (nodejs.org)."
  open "https://nodejs.org/de/download"
  pause_exit
fi

ENV_FILE="server/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "  Erster Start: Anthropic-API-Schlüssel eingeben (beginnt mit sk-ant-)."
  echo "  Zu finden unter console.anthropic.com → API Keys. Die Eingabe bleibt unsichtbar."
  echo "  Einfach Enter drücken, um ohne KI (Offline-Persona) zu starten."
  echo
  read -r -s -p "  Schlüssel: " KEY; echo
  umask 077
  if [ -n "$KEY" ]; then printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" > "$ENV_FILE"; echo "  ✓ Schlüssel gespeichert (nur auf diesem Mac, Datei server/.env)."
  else : > "$ENV_FILE"; echo "  → Start ohne KI-Schlüssel."; fi
  echo
fi

if [ ! -d node_modules ]; then echo "  Installiere Komponenten (einmalig, ca. 1 Minute) …"; npm install --no-audit --no-fund --loglevel=error || pause_exit; fi
if [ ! -d server/node_modules ]; then (cd server && npm install --no-audit --no-fund --loglevel=error) || pause_exit; fi

if [ ! -f dist/index.html ] || [ -n "$(find src shared public index.html -newer dist/index.html -print -quit 2>/dev/null)" ]; then
  echo "  Baue die Oberfläche …"
  npm run build --silent >/dev/null 2>&1 || { echo "  Build fehlgeschlagen:"; npm run build; pause_exit; }
fi

echo "  Starte … (dieses Fenster offen lassen, zum Beenden einfach schließen)"
echo
( sleep 1.5; open "http://localhost:8787" ) &
exec node --env-file="$ENV_FILE" server/index.mjs
