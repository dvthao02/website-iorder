#!/bin/sh
# Xuất data nền (nội dung, cấu hình, media metadata) ra scripts/data/base-content.sql để nạp vào DB mới
# sau `pnpm db:migrate` và `pnpm db:seed:admin`. Không xuất: log, lịch sử phiên bản, phiên đăng nhập,
# khách hàng tiềm năng, tài khoản/vai trò (seed-admin lo). Các cột trỏ tới user (uploaded_by, author_id,
# updated_by) được đặt NULL. Dùng schema tạm `export_tmp`, tự xóa khi xong. Chỉ dùng cho DB local.
set -eu
DB="${DB_SERVICE:-iorder-v2-db-1}"
OUT="$(dirname "$0")/data/base-content.sql"
TABLES="site_profile site_settings menus menu_items pages page_blocks categories tags posts post_categories post_tags offerings equipment_groups sales_equipment media_assets partners testimonials support_downloads redirects"

psql_in() { docker exec -i "$DB" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'; }

{
  echo "drop schema if exists export_tmp cascade; create schema export_tmp;"
  for t in $TABLES; do echo "create table export_tmp.$t as table public.$t;"; done
  echo "update export_tmp.media_assets set uploaded_by = null;"
  echo "update export_tmp.posts set author_id = null;"
  echo "update export_tmp.site_settings set updated_by = null;"
} | psql_in >/dev/null

{
  echo "-- Data nền iOrder V2, sinh bởi scripts/export-base-data.sh. Chạy sau migrate + seed-admin, trên DB còn trống bảng nội dung."
  echo "-- Media chỉ có metadata: tệp thật cần chép qua scripts/backup-media.mjs (backup/restore)."
  echo "begin;"
  echo "set local session_replication_role = replica;"
  docker exec "$DB" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -n export_tmp --data-only --inserts --no-owner' \
    | awk '/^INSERT INTO /{on=1} on' | grep -v '^.unrestrict ' | sed 's/^INSERT INTO export_tmp\./INSERT INTO public./'
  echo "commit;"
} > "$OUT"

echo "drop schema export_tmp cascade;" | psql_in >/dev/null
echo "Đã ghi $OUT"
