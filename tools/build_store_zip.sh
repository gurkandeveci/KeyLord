#!/usr/bin/env bash
# Chrome Web Mağazası'na yüklenecek paketi (KeyLord-store.zip) hazırlar.
# - manifest.json'daki "key" alanını çıkarır (mağaza ilk yüklemede kabul etmez).
# - --with-key: key.pem'i paketin köküne koyar (ilk yüklemede mevcut kimliği korumayı denemek için).
# Kullanım: tools/build_store_zip.sh [--with-key]
set -euo pipefail

cd "$(dirname "$0")/.."
WITH_KEY=0
[ "${1:-}" = "--with-key" ] && WITH_KEY=1

OUT="KeyLord-store.zip"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -R background.js vault.html src icons LICENSE "$STAGE/"
python3 -I - manifest.json "$STAGE/manifest.json" <<'EOF'
import json, sys
m = json.load(open(sys.argv[1], encoding='utf-8'))
m.pop('key', None)
json.dump(m, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
EOF

if [ "$WITH_KEY" = 1 ]; then
  if [ ! -f key.pem ]; then
    echo "key.pem bulunamadı; --with-key olmadan çalıştırın ya da anahtarı proje köküne koyun." >&2
    exit 1
  fi
  cp key.pem "$STAGE/key.pem"
fi

rm -f "$OUT"
(cd "$STAGE" && find . -name '.DS_Store' -delete && zip -qr - .) > "$OUT"
echo "Hazır: $OUT (sürüm $(python3 -I -c "import json;print(json.load(open('manifest.json'))['version'])"), key.pem: $([ "$WITH_KEY" = 1 ] && echo var || echo yok))"
unzip -l "$OUT" | tail -1
