#!/usr/bin/env bash
# Chrome Web Mağazası görsellerini (store/assets/*.png) headless Chrome ile üretir.
# Sayfalar store/assets-src/ altındadır; eklentinin gerçek dosyalarını test taklidiyle (tests/chrome-shim.js) çalıştırır.
# Kullanım: tools/make_store_assets.sh
set -euo pipefail

cd "$(dirname "$0")/.."
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
PORT="${PORT:-8799}"
OUT="store/assets"
PROFILE="$(mktemp -d)"
mkdir -p "$OUT"

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf "$PROFILE"' EXIT
sleep 1

shot() { # url dosya genişlik yükseklik [alan-adı]
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --user-data-dir="$PROFILE" --window-size="$3,$4" --virtual-time-budget=6000 \
    --host-resolver-rules="MAP *.example.local 127.0.0.1" \
    --screenshot="$OUT/$2" "http://${5:-127.0.0.1}:$PORT/$1" >/dev/null 2>&1
  echo "$OUT/$2 $(sips -g pixelWidth -g pixelHeight "$OUT/$2" | awk '/pixel/{printf "%s ", $2}')"
}

shot "store/assets-src/shot-console.html" screenshot-1-console.png 1280 800 vcenter.example.local
shot "store/assets-src/shot-password.html" screenshot-2-password.png 1280 800 firewall-01.example.local
shot "store/assets-src/shot-vault.html?iterations=1000&email=ornek@example.com" screenshot-3-vault.png 1280 800
shot "store/assets-src/promo-small.html" promo-small-440x280.png 440 280
