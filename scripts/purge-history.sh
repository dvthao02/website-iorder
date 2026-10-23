#!/bin/sh
# Xóa toàn bộ nhật ký (audit_logs) và lịch sử phiên bản (*_revisions) của DB local. KHÔNG THỂ KHÔI PHỤC.
# Giữ nguyên nội dung, cấu hình, tài khoản, phiên đăng nhập. Chạy: CONFIRM=yes sh scripts/purge-history.sh
set -eu
[ "${CONFIRM:-}" = "yes" ] || { echo "Đặt CONFIRM=yes để xác nhận xóa nhật ký và lịch sử phiên bản."; exit 1; }
DB="${DB_SERVICE:-iorder-v2-db-1}"
docker exec -i "$DB" sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
truncate table audit_logs, page_revisions, post_revisions, offering_revisions, sales_equipment_revisions, menu_revisions, support_download_revisions;
SQL
