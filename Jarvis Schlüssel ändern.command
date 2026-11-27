#!/bin/bash
# Löscht den gespeicherten Anthropic-Schlüssel. Beim nächsten "Jarvis starten" wird neu gefragt.
cd "$(dirname "$0")" || exit 1
rm -f server/.env
echo
echo "  Gespeicherter Schlüssel entfernt. Jetzt J.A.R.V.I.S. beenden (Fenster schließen) und neu starten."
echo
read -n 1 -s -r -p "  Taste drücken zum Schließen …"; echo
