#!/usr/bin/env bash
# Sao lưu production trên VPS: database iOrder (+ Umami nếu có) bằng pg_dump, thử khôi phục
# vào database tạm, sao lưu media theo object, rồi xoá bớt bản cũ.
# Chạy ở thư mục repo; lên lịch bằng cron của host, ví dụ mỗi ngày 2:30:
#   30 2 * * * cd /srv/iorder && scripts/backup.sh >> /var/log/iorder-backup.log 2>&1
# Biến tùy chọn: BACKUP_DIR (mặc định /var/backups/iorder), BACKUP_KEEP (số bản DB giữ lại, mặc định 14),
# BACKUP_VERIFY=0 để bỏ bước thử khôi phục, ENV_FILE, COMPOSE_FILE.
set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/var/backups/iorder}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"
BACKUP_VERIFY="${BACKUP_VERIFY:-1}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yaml}"
CHECK_DB="iorder_restore_check"

compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
db_sh() { compose exec -T db sh -c "$1" sh "${@:2}"; }
log() { echo "[$(date -u +%FT%TZ)] $*"; }

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/media"
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || { log "Một lần sao lưu khác đang chạy, dừng."; exit 1; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
partial="$BACKUP_DIR/db/$stamp.partial"
rm -rf "$BACKUP_DIR"/db/*.partial
mkdir -p "$partial"

databases=("$(db_sh 'printf %s "$POSTGRES_DB"')")
if [ "$(db_sh 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select 1 from pg_database where datname = '"'"'umami'"'"'"')" = "1" ]; then
  databases+=("umami")
fi

for name in "${databases[@]}"; do
  log "Dump database $name"
  db_sh 'pg_dump -U "$POSTGRES_USER" -Fc --no-owner "$1"' "$name" > "$partial/$name.dump"
  # Đọc được mục lục nghĩa là tệp dump không bị cắt cụt.
  db_sh 'pg_restore --list > /dev/null' < "$partial/$name.dump"
done

if [ "$BACKUP_VERIFY" = "1" ]; then
  main="${databases[0]}"
  log "Thử khôi phục $main vào database tạm $CHECK_DB"
  db_sh 'dropdb -U "$POSTGRES_USER" --if-exists "$1" && createdb -U "$POSTGRES_USER" "$1"' "$CHECK_DB"
  trap 'db_sh "dropdb -U \"\$POSTGRES_USER\" --if-exists \"\$1\"" "$CHECK_DB" || true' EXIT
  db_sh 'pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d "$1"' "$CHECK_DB" < "$partial/$main.dump"
  read -r migrations users media < <(db_sh 'psql -U "$POSTGRES_USER" -d "$1" -tA -F " " -c "select (select count(*) from drizzle.__drizzle_migrations), (select count(*) from users), (select count(*) from media_assets)"' "$CHECK_DB")
  log "Khôi phục thử: $migrations migration, $users tài khoản, $media media"
  if [ "${migrations:-0}" -eq 0 ] || [ "${users:-0}" -eq 0 ]; then log "Bản khôi phục không có dữ liệu, coi là lỗi."; exit 1; fi
  db_sh 'dropdb -U "$POSTGRES_USER" "$1"' "$CHECK_DB"
  trap - EXIT
fi

(cd "$partial" && sha256sum ./*.dump > SHA256SUMS)
mv "$partial" "$BACKUP_DIR/db/$stamp"

log "Sao lưu media vào $BACKUP_DIR/media"
compose run --rm --no-deps -v "$BACKUP_DIR/media:/backup/media" backup-media

# Giữ BACKUP_KEEP bản database mới nhất; media chỉ thêm, không xoá.
mapfile -t old < <(find "$BACKUP_DIR/db" -mindepth 1 -maxdepth 1 -type d ! -name '*.partial' | sort | head -n "-$BACKUP_KEEP")
for dir in "${old[@]}"; do rm -rf "$dir"; done
log "Hoàn tất $stamp (xoá ${#old[@]} bản cũ)."
