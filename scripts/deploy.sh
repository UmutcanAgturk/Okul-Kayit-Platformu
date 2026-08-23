#!/usr/bin/env bash
#
# Seviye 360 — üretim deploy scripti (HestiaCP sunucusu).
# Sunucuda `seviyeokul` kullanıcısının repo kopyasında çalıştırılır:
#
#     cd /home/seviyeokul/seviye360 && ./scripts/deploy.sh
#
# Yaptıkları: GitHub'dan çek → bağımlılıklar → migration → prisma generate →
# apps/web bağımlılıkları → build → PM2 yeniden başlat → sağlık kontrolü.
# Herhangi bir adım hata verirse durur (set -e) ve PM2 restart'a geçmez.
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_DIR="$APP_DIR/apps/web"
PM2_NAME="seviye360-web"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/login}"

cd "$APP_DIR"
echo "▶ 1/6  git pull"
git pull origin main

echo "▶ 2/6  kök bağımlılıklar + prisma"
npm install --no-audit --no-fund
npx prisma migrate deploy
npx prisma generate

echo "▶ 3/6  apps/web bağımlılıklar"
cd "$WEB_DIR"
npm install --no-audit --no-fund

echo "▶ 4/6  build"
npm run build

echo "▶ 5/6  PM2 restart"
pm2 restart "$PM2_NAME" --update-env

echo "▶ 6/6  sağlık kontrolü ($HEALTH_URL)"
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)"
  if [ "$code" = "200" ]; then
    echo "✓ Deploy tamam — $HEALTH_URL → 200"
    exit 0
  fi
  sleep 2
done
echo "✗ Sağlık kontrolü başarısız (son kod: ${code:-yok}). PM2 loglarına bakın: pm2 logs $PM2_NAME"
exit 1
