-- Ghi kết quả một lần sao lưu vào site_settings để CMS hiện ở Tổng quan (packages/core/src/server/backup/backup-status.ts).
-- Dùng chung cho scripts/backup.sh và scripts/backup.ps1: đưa vào stdin của psql trong container db,
-- giá trị lấy từ biến môi trường (docker compose exec -e ...), không ghép chuỗi SQL.
--   BACKUP_SUCCESS=true|false, BACKUP_SOURCE=vps|windows
--   thành công: BACKUP_STAMP, BACKUP_BYTES, BACKUP_VERIFIED=true|false, BACKUP_USERS, BACKUP_MEDIA (để trống nếu không khôi phục thử)
--   lỗi: BACKUP_MESSAGE
\set ON_ERROR_STOP on
set client_encoding = 'UTF8';
\getenv success BACKUP_SUCCESS
\getenv source BACKUP_SOURCE
\getenv stamp BACKUP_STAMP
\getenv bytes BACKUP_BYTES
\getenv verified BACKUP_VERIFIED
\getenv users BACKUP_USERS
\getenv media BACKUP_MEDIA
\getenv message BACKUP_MESSAGE
\if :success
insert into site_settings (key, value, description)
values ('system.backup.success', jsonb_build_object(
  'finishedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'source', :'source',
  'stamp', :'stamp',
  'databaseBytes', (:'bytes')::bigint,
  'verified', (:'verified')::boolean,
  'users', nullif(:'users', '')::int,
  'mediaAssets', nullif(:'media', '')::int
), 'Lần sao lưu thành công gần nhất (script sao lưu tự ghi)')
on conflict (key) do update set value = excluded.value, updated_at = now(), version = site_settings.version + 1;
\else
insert into site_settings (key, value, description)
values ('system.backup.failure', jsonb_build_object(
  'failedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'source', :'source',
  'message', left(:'message', 500)
), 'Lần sao lưu lỗi gần nhất (script sao lưu tự ghi)')
on conflict (key) do update set value = excluded.value, updated_at = now(), version = site_settings.version + 1;
\endif
