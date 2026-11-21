#!/bin/bash
# Sabit uzantı kimliği için anahtar çifti üretir. key.pem (gizli) repoya girmez.
# Çıktı: manifest.json "key" alanına konacak base64 DER açık anahtar ve hesaplanan uzantı kimliği.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -e key.pem ]; then
  echo "Hata: key.pem zaten var; üzerine yazılmaz. Önce elle taşıyın veya silin." >&2
  exit 1
fi

umask 077
openssl genrsa -out key.pem 2048 2>/dev/null
chmod 600 key.pem

PUB=$(openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | openssl base64 -A)
# Kimlik: DER baytlarının SHA-256'sının ilk 32 hex karakteri, 0-9a-f -> a-p
ID=$(openssl rsa -in key.pem -pubout -outform DER 2>/dev/null | openssl dgst -sha256 -binary | xxd -p -c 64 | cut -c1-32 | tr '0-9a-f' 'a-p')

echo "Açık anahtar (manifest.json \"key\"):"
echo "$PUB"
echo "Uzantı kimliği:"
echo "$ID"
