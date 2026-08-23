#!/usr/bin/env bash
#
# Seviye 360 — PostgreSQL yedekleme scripti.
# GÜVENLİK NOTU: Bu script HENÜZ SUNUCUDA KURULMADI — sunucuda tespit edilen
# olası rootkit (bkz. /etc/ld.so.preload / libnss_cache.so.2) temizlenip
# sunucunun güvenilirliği doğrulanmadan üretimde ÇALIŞTIRILMAMALIDIR;
# ele geçirilmiş bir makineden alınan yedek de şüphelidir.
#
# Temiz bir sunucuda kurulum:
#   1) Bu dosyayı /usr/local/bin/pg-backup.sh olarak kopyalayın, chmod +x
#   2) Aşağıdaki değişkenleri ortama uygun ayarlayın (veya /etc/default içine)
#   3) Cron (root): 0 3 * * *  /usr/local/bin/pg-backup.sh >> /var/log/pg-backup.log 2>&1
#   4) OFFSITE_* değişkenlerini doldurup uzak kopyayı aktive edin — tek diskteki
#      yedek gerçek yedek değildir.
set -euo pipefail

DB_NAME="${DB_NAME:-seviye360}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/seviye360}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/seviye360-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

# 1) Sıkıştırılmış tam dump
sudo -u "$DB_USER" pg_dump --no-owner --no-privileges "$DB_NAME" | gzip -9 > "$OUT"
echo "[$(date -Is)] Yedek alındı: $OUT ($(du -h "$OUT" | cut -f1))"

# 2) Bütünlük kontrolü — gzip bozuksa fail et
if ! gzip -t "$OUT"; then
  echo "[$(date -Is)] HATA: yedek dosyası bozuk, siliniyor: $OUT"
  rm -f "$OUT"
  exit 1
fi

# 3) Eski yedekleri temizle
find "$BACKUP_DIR" -name 'seviye360-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
echo "[$(date -Is)] $RETENTION_DAYS günden eski yedekler temizlendi."

# 4) OFFSITE (opsiyonel) — uzak kopya. En az biri doldurulmalı.
#    a) rsync ile başka sunucuya:
#       OFFSITE_RSYNC="user@yedek-sunucu:/backups/seviye360/"
if [ -n "${OFFSITE_RSYNC:-}" ]; then
  rsync -az "$OUT" "$OFFSITE_RSYNC" && echo "[$(date -Is)] Offsite rsync tamam: $OFFSITE_RSYNC"
fi
#    b) S3 uyumlu depoya (aws cli / rclone kuruluysa):
#       OFFSITE_RCLONE="s3remote:seviye360-backups"
if [ -n "${OFFSITE_RCLONE:-}" ]; then
  rclone copy "$OUT" "$OFFSITE_RCLONE" && echo "[$(date -Is)] Offsite rclone tamam: $OFFSITE_RCLONE"
fi

if [ -z "${OFFSITE_RSYNC:-}" ] && [ -z "${OFFSITE_RCLONE:-}" ]; then
  echo "[$(date -Is)] UYARI: OFFSITE hedefi tanımlı değil — yedek yalnızca yerel diskte. Disk/sunucu kaybında yedek de kaybolur."
fi
