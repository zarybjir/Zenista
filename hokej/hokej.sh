#!/bin/bash
# Spouštěč Hokej '98 pro SteamOS / Linux (Legion Go S, Steam Deck…)
# Přidej tento soubor do Steamu jako „hru mimo Steam" (Add a Non-Steam Game).
# Spustí malý lokální web server a prohlížeč Chromium/Chrome v režimu kiosku (celá obrazovka).

DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
PORT=47098
URL="http://127.0.0.1:$PORT/index.html"
LOG="${XDG_CACHE_HOME:-$HOME/.cache}/hokej98.log"
mkdir -p "$(dirname "$LOG")"
exec >"$LOG" 2>&1
echo "Hokej '98 start: $(date)  dir=$DIR"

# --- lokální server (python3 je ve SteamOS) ---
SRV=""
if ! (exec 3<>/dev/tcp/127.0.0.1/$PORT) 2>/dev/null; then
  python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$DIR" &
  SRV=$!
  for _ in $(seq 1 40); do (exec 3<>/dev/tcp/127.0.0.1/$PORT) 2>/dev/null && break; sleep 0.1; done
fi
cleanup() { [ -n "$SRV" ] && kill "$SRV" 2>/dev/null; }
trap cleanup EXIT INT TERM

FLAGS=(--kiosk --start-fullscreen --autoplay-policy=no-user-gesture-required --no-first-run
       --no-default-browser-check --disable-translate --disable-features=Translate,MediaRouter
       --password-store=basic --app="$URL")

run_flatpak() { # $1 = flatpak id
  local prof="$HOME/.var/app/$1/hokej98-profile"
  mkdir -p "$prof"
  flatpak run "$1" --user-data-dir="$prof" "${FLAGS[@]}"
}

if command -v flatpak >/dev/null && flatpak info org.chromium.Chromium >/dev/null 2>&1; then
  run_flatpak org.chromium.Chromium
elif command -v flatpak >/dev/null && flatpak info com.google.Chrome >/dev/null 2>&1; then
  run_flatpak com.google.Chrome
elif command -v flatpak >/dev/null && flatpak info com.brave.Browser >/dev/null 2>&1; then
  run_flatpak com.brave.Browser
elif command -v flatpak >/dev/null && flatpak info com.microsoft.Edge >/dev/null 2>&1; then
  run_flatpak com.microsoft.Edge
elif B=$(command -v chromium || command -v chromium-browser || command -v google-chrome || command -v google-chrome-stable); then
  PROF="$HOME/.local/share/hokej98-profile"; mkdir -p "$PROF"
  "$B" --user-data-dir="$PROF" "${FLAGS[@]}"
elif command -v flatpak >/dev/null && flatpak info org.mozilla.firefox >/dev/null 2>&1; then
  flatpak run org.mozilla.firefox --kiosk "$URL"
elif command -v firefox >/dev/null; then
  firefox --kiosk "$URL"
else
  echo "Nenalezen Chromium/Chrome ani Firefox. Nainstaluj Chromium z aplikace Discover."
  command -v zenity >/dev/null && zenity --error --text="Hokej '98: nainstaluj prosím Chromium (Discover → Chromium)."
  exit 1
fi
