#!/usr/bin/env bash
# Sao lưu production trên VPS: database iOrder (+ Umami nếu có) bằng pg_dump, thử khôi phục
# vào database tạm, sao lưu media theo object, rồi xoá bớt bản cũ. Kết quả (thành công/lỗi) được ghi vào
# site_settings qua scripts/backup-status.sql để CMS hiện ở Tổng quan và báo khi lỗi hoặc quá hạn.
# Chạy ở thư mục repo; lên lịch bằng cron của host, ví dụ mỗi ngày 2:30:
#   30 2 * * * cd /srv/iorder && scripts/backup.sh >> /var/log/iorder-backup.log 2>&1
# Biến tùy chọn: BACKUP_DIR (mặc định /var/backups/iorder), BACKUP_KEEP (số bản DB giữ lại; không đặt thì lấy số Super Admin chỉnh trong CMS, mặc định 14),
# BACKUP_VERIFY=0 để bỏ bước thử khôi phục, BACKUP_MEDIA_VERIFY=1 để băm lại mọi tệp media trên đĩa (chậm hơn,
# nên chạy thỉnh thoảng), ENV_FILE, COMPOSE_FILE.
set -Eeuo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/var/backups/iorder}"
BACKUP_VERIFY="${BACKUP_VERIFY:-1}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yaml}"
CHECK_DB="iorder_restore_check_$(date -u +%Y%m%d%H%M%S)_$$"

compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
db_sh() { compose exec -T db sh -c "$1" sh "${@:2}"; }
log() { echo "[$(date -u +%FT%TZ)] $*"; }
# Số bản DB giữ lại: BACKUP_KEEP (nếu đặt) thắng; không thì đọc site_settings "system.backup.keep" (Super Admin chỉnh ở màn Sao lưu
# của CMS, cùng khoảng 3-60 với backup-retention.ts); thiếu hoặc không hợp lệ thì 14.
resolve_keep() {
  if [ -n "${BACKUP_KEEP:-}" ]; then echo "$BACKUP_KEEP"; return; fi
  local value
  value="$(db_sh 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "select value from site_settings where key = '"'"'system.backup.keep'"'"'"' 2>/dev/null || true)"
  if [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 3 ] && [ "$value" -le 60 ]; then echo "$value"; else echo 14; fi
}
record_status() { compose exec -T -e BACKUP_SOURCE=vps -e "BACKUP_LOCATION=$BACKUP_DIR" -e "BACKUP_REPO=$PWD" "$@" db sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' < scripts/backup-status.sql; }
fail() {
  log "$1"
  record_status -e BACKUP_SUCCESS=false -e "BACKUP_MESSAGE=$1" || log "Không ghi được trạng thái lỗi vào database."
}

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/media"
exec 9>"$BACKUP_DIR/.lock"
flock -n 9 || { log "Một lần sao lưu khác đang chạy, dừng."; exit 1; }
step="chuẩn bị"
trap 'fail "Sao lưu lỗi ở bước: $step."' ERR

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
partial="$BACKUP_DIR/db/$stamp.partial"
rm -rf "$BACKUP_DIR"/db/*.partial
mkdir -p "$partial"

databases=("$(db_sh 'printf %s "$POSTGRES_DB"')")
if [ "$(db_sh 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "select 1 from pg_database where datname = '"'"'umami'"'"'"')" = "1" ]; then
  databases+=("umami")
fi

for name in "${databases[@]}"; do
  step="dump database $name"
  log "Dump database $name"
  db_sh 'pg_dump -U "$POSTGRES_USER" -Fc --no-owner "$1"' "$name" > "$partial/$name.dump"
  # Đọc được mục lục nghĩa là tệp dump không bị cắt cụt.
  db_sh 'pg_restore --list > /dev/null' < "$partial/$name.dump"
done

users="" media=""
if [ "$BACKUP_VERIFY" = "1" ]; then
  step="khôi phục thử"
  main="${databases[0]}"
  log "Thử khôi phục $main vào database tạm $CHECK_DB"
  # Khong xoa database co san neu trung ten; chi don sau khi createdb thanh cong.
  db_sh 'createdb -U "$POSTGRES_USER" "$1"' "$CHECK_DB"
  trap 'db_sh "dropdb -U \"\$POSTGRES_USER\" --if-exists \"\$1\"" "$CHECK_DB" || true' EXIT
  db_sh 'pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d "$1"' "$CHECK_DB" < "$partial/$main.dump"
  read -r migrations users media < <(db_sh 'psql -U "$POSTGRES_USER" -d "$1" -tA -F " " -c "select (select count(*) from drizzle.__drizzle_migrations), (select count(*) from users u where to_jsonb(u)->>\$\$deleted_at\$\$ is null), (select count(*) from media_assets)"' "$CHECK_DB")
  log "Khôi phục thử: $migrations migration, $users tài khoản, $media media"
  if [ "${migrations:-0}" -eq 0 ] || [ "${users:-0}" -eq 0 ]; then fail "Bản khôi phục thử không có dữ liệu."; exit 1; fi
  db_sh 'dropdb -U "$POSTGRES_USER" "$1"' "$CHECK_DB"
  trap - EXIT
fi

(cd "$partial" && sha256sum ./*.dump > SHA256SUMS)
bytes="$(cat "$partial"/*.dump | wc -c)"
mv "$partial" "$BACKUP_DIR/db/$stamp"

step="sao lưu media"
log "Sao lưu media vào $BACKUP_DIR/media"
if [ "${BACKUP_MEDIA_VERIFY:-0}" = "1" ]; then
  compose run --rm --no-deps -v "$BACKUP_DIR/media:/backup/media" backup-media node scripts/backup-media.mjs backup /backup/media --verify
else
  compose run --rm --no-deps -v "$BACKUP_DIR/media:/backup/media" backup-media
fi

# Giữ BACKUP_KEEP bản database mới nhất; media chỉ thêm, không xoá.
step="xoá bản cũ"
BACKUP_KEEP="$(resolve_keep)"
# Chỉ thư mục đúng dạng mã thời gian: bản chép tay tên lạ và bản đang dở không bị tính hay bị xóa.
mapfile -t old < <(find "$BACKUP_DIR/db" -mindepth 1 -maxdepth 1 -type d -name '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z' | sort | head -n "-$BACKUP_KEEP")
for dir in "${old[@]}"; do rm -rf "$dir"; done
step="ghi trạng thái"
verified=false; [ "$BACKUP_VERIFY" = "1" ] && verified=true
record_status -e BACKUP_SUCCESS=true -e "BACKUP_STAMP=$stamp" -e "BACKUP_DATABASE=${databases[0]}" -e "BACKUP_BYTES=$bytes" -e "BACKUP_VERIFIED=$verified" -e "BACKUP_USERS=$users" -e "BACKUP_MEDIA=$media"
log "Hoàn tất $stamp (xoá ${#old[@]} bản cũ)."
