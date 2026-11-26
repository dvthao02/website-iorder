#!/usr/bin/env bash
# Nạp gói chuyển (database + media) vào hệ thống production MỚI bằng một lệnh, đúng thứ tự và có kiểm tra ở từng bước:
#   CONFIRM=yes scripts/restore-package.sh /srv/iorder-transfer
# Gói do scripts/backup.ps1 (Windows) hoặc scripts/backup.sh (VPS) tạo: <gói>/db/<mã-thời-gian>/{<tên-db>.dump, umami.dump, SHA256SUMS} và <gói>/media/.
# Trình tự: kiểm tra checksum → bật db và s3 → kiểm tra database đích còn trống → dừng ứng dụng → phục hồi database → đưa media lên S3
#   → khởi động lại (job migrate tự áp migration còn thiếu) → thử đọc từng ảnh/tệp còn dùng qua Backend.
# Lệnh GHI ĐÈ database đích bằng bản trong gói, nên mặc định từ chối nếu database đích đã có trang, bài viết hoặc media.
# Chạy sau khi hệ thống đã lên bằng `up -d --build` (xem lệnh ở scripts/backup.sh). Không dùng trên hệ thống đang có dữ liệu thật.
# Biến: CONFIRM=yes (bắt buộc), STAMP (mã bản trong gói; mặc định bản mới nhất), ENV_FILE (mặc định .env.production),
# COMPOSE_FILE (mặc định compose.production.yaml), FORCE=1 (bỏ kiểm tra database đích còn trống), START_SERVICES (dịch vụ khởi động lại ở bước cuối;
# mặc định tất cả), WITH_UMAMI=1 (nạp cả database thống kê Umami nếu gói có; khi đó UMAMI_WEBSITE_ID/UMAMI_API_KEY phải là giá trị của bản gốc).
set -Eeuo pipefail
umask 077

PKG="${1:-}"
ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-compose.production.yaml}"
step="chuẩn bị"

log() { echo "[$(date -u +%FT%TZ)] $*"; }
die() { log "LỖI: $*"; exit 1; }
compose() { docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
# Chạy lệnh sh trong container db; tham số sau đó thành $1, $2... của lệnh (khỏi phải lồng dấu nháy).
db_sh() { compose exec -T db sh -c "$1" sh "${@:2}"; }
main_sql() { db_sh 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$1"' "$1"; }
trap 'log "LỖI ở bước: $step. Nếu đã qua bước phục hồi database thì database đích đang dở dang: xem lỗi rồi chạy lại với FORCE=1."' ERR

if [ -z "$PKG" ] || [ ! -d "$PKG/db" ] || [ ! -d "$PKG/media" ]; then die "Cách dùng: CONFIRM=yes $0 <thư-mục-gói> (trong đó phải có db/ và media/)."; fi
[ "${CONFIRM:-}" = "yes" ] || die "Lệnh này ghi đè database đích bằng bản trong gói. Đặt CONFIRM=yes để xác nhận."
[ -f "$ENV_FILE" ] || die "Thiếu $ENV_FILE."
# Git Bash trên Windows cần đường dẫn kiểu Windows cho docker -v; Linux không có `pwd -W` nên dùng pwd thường.
pkg_host="$(cd "$PKG" && { pwd -W 2>/dev/null || pwd; })"

step="chọn bản database trong gói"
stamp="${STAMP:-}"
if [ -z "$stamp" ]; then
  stamp="$(find "$PKG/db" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*T[0-9]*Z' -printf '%f\n' | sort | tail -n 1)"
fi
dir="$PKG/db/$stamp"
[ -n "$stamp" ] && [ -d "$dir" ] || die "Không thấy bản database nào trong $PKG/db."
[ -f "$dir/SHA256SUMS" ] || die "Thiếu $dir/SHA256SUMS."
step="kiểm tra checksum"
(cd "$dir" && sha256sum -c SHA256SUMS) || die "Checksum không khớp: gói bị hỏng khi chép, hãy chép lại."
mapfile -t dumps < <(find "$dir" -maxdepth 1 -name '*.dump' ! -name 'umami.dump' | sort)
[ "${#dumps[@]}" -eq 1 ] || die "Cần đúng một tệp .dump (không kể umami.dump) trong $dir, hiện có ${#dumps[@]}."
main_dump="${dumps[0]}"
media_files="$(find "$PKG/media" -type f ! -name '.iorder-media-manifest.json*' | wc -l | tr -d ' ')"
[ "$media_files" -gt 0 ] || die "Thư mục media trong gói trống."
log "Gói: bản $stamp, $(basename "$main_dump"), $media_files tệp media."

step="bật db và s3"
compose up -d --wait db s3 > /dev/null
db_sh 'pg_restore --list > /dev/null' < "$main_dump" || die "Không đọc được mục lục của $(basename "$main_dump")."

step="kiểm tra database đích còn trống"
if [ "$(main_sql "select to_regclass('public.media_assets') is not null")" = "t" ] && [ "${FORCE:-0}" != "1" ]; then
  existing="$(main_sql "select (select count(*) from pages) + (select count(*) from posts) + (select count(*) from media_assets)")"
  [ "$existing" = "0" ] || die "Database đích đã có $existing bản ghi (trang/bài viết/media), không ghi đè. Đặt FORCE=1 nếu chắc chắn."
fi

step="dừng ứng dụng"
log "Dừng api, admin, website"
compose stop api admin website

step="phục hồi database"
log "Phục hồi database từ $(basename "$main_dump")"
db_sh 'dropdb -U "$POSTGRES_USER" --force --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d "$POSTGRES_DB"' < "$main_dump"
IFS='|' read -r migrations users media_rows < <(main_sql "select (select count(*) from drizzle.__drizzle_migrations), (select count(*) from users), (select count(*) from media_assets)")
log "Sau khi phục hồi: $migrations migration, $users tài khoản, $media_rows media trong database."
[ "${migrations:-0}" -gt 0 ] && [ "${users:-0}" -gt 0 ] || die "Database sau phục hồi không có dữ liệu."

if [ "${WITH_UMAMI:-0}" = "1" ] && [ -f "$dir/umami.dump" ]; then
  step="phục hồi Umami"
  log "Phục hồi database Umami"
  compose stop umami
  db_sh 'dropdb -U "$POSTGRES_USER" --force --if-exists umami && createdb -U "$POSTGRES_USER" umami && pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d umami' < "$dir/umami.dump"
fi

step="đưa media lên S3"
log "Đưa media lên S3"
compose run --rm --no-deps -v "$pkg_host/media:/backup/media" backup-media node scripts/backup-media.mjs restore /backup/media

step="khởi động lại ứng dụng"
log "Khởi động lại (migrate áp migration còn thiếu)"
# shellcheck disable=SC2086
compose up -d ${START_SERVICES:-}
for _ in $(seq 1 60); do
  compose exec -T api node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))" > /dev/null 2>&1 && break
  sleep 3
done

step="thử đọc media"
log "Thử đọc mọi tệp media còn dùng qua Backend"
mapfile -t keys < <(main_sql "select storage_key from media_assets where deleted_at is null order by created_at")
# Một tiến trình node đọc từng khóa từ stdin; in dòng LOI cho tệp không trả 200.
if printf '%s\n' "${keys[@]}" | compose exec -T api node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",async()=>{const keys=s.split("\n").filter(Boolean);let bad=0;for(const k of keys){let c=0;try{const r=await fetch("http://127.0.0.1:3000/media/"+k.split("/").map(encodeURIComponent).join("/"));c=r.status;await r.arrayBuffer()}catch{}if(c!==200){bad++;console.log("LOI "+c+" "+k)}}console.log("Đọc được "+(keys.length-bad)+"/"+keys.length+" tệp");process.exit(bad?1:0)})'; then
  log "Hoàn tất: database và media đã nạp, mọi tệp media còn dùng đều đọc được."
else
  die "Có tệp media không đọc được (liệt kê ở trên): chép lại thư mục media của gói rồi chạy lại bước media."
fi
