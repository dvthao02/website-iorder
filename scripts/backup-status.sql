-- Ghi kết quả một lần sao lưu vào site_settings để CMS hiện ở Tổng quan và trang Sao lưu & phục hồi
-- (packages/shared/src/server/backup/backup-status.ts). Ghi 2 khóa: lần thành công/lỗi gần nhất
-- (system.backup.success | system.backup.failure) và lịch sử 30 lần gần nhất (system.backup.history, mới nhất trước).
-- Dùng chung cho scripts/backup.sh và scripts/backup.ps1: đưa vào stdin của psql trong container db,
-- giá trị lấy từ biến môi trường (docker compose exec -e ...), không ghép chuỗi SQL.
--   BACKUP_SUCCESS=true|false, BACKUP_SOURCE=vps|windows, BACKUP_LOCATION (thư mục sao lưu), BACKUP_REPO (thư mục repo)
--   trên máy chạy script; CMS dùng hai đường dẫn này để điền sẵn lệnh phục hồi
--   thành công: BACKUP_STAMP, BACKUP_DATABASE (tên database chính = tên tệp .dump), BACKUP_BYTES, BACKUP_VERIFIED=true|false, BACKUP_USERS, BACKUP_MEDIA (để trống nếu không khôi phục thử)
--   lỗi: BACKUP_MESSAGE
\set ON_ERROR_STOP on
set client_encoding = 'UTF8';
\getenv success BACKUP_SUCCESS
\getenv source BACKUP_SOURCE
\getenv location BACKUP_LOCATION
\getenv repo BACKUP_REPO
\getenv database BACKUP_DATABASE
\getenv stamp BACKUP_STAMP
\getenv bytes BACKUP_BYTES
\getenv verified BACKUP_VERIFIED
\getenv users BACKUP_USERS
\getenv media BACKUP_MEDIA
\getenv message BACKUP_MESSAGE
\if :success
select 'system.backup.success' as entry_key, 'Lần sao lưu thành công gần nhất (script sao lưu tự ghi)' as entry_description, jsonb_strip_nulls(jsonb_build_object(
  'finishedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'source', :'source',
  'location', nullif(:'location', ''),
  'repoDir', nullif(:'repo', ''),
  'stamp', :'stamp',
  'database', nullif(:'database', ''),
  'databaseBytes', (:'bytes')::bigint,
  'verified', (:'verified')::boolean
) || jsonb_build_object('users', nullif(:'users', '')::int, 'mediaAssets', nullif(:'media', '')::int))::text as entry \gset
\else
select 'system.backup.failure' as entry_key, 'Lần sao lưu lỗi gần nhất (script sao lưu tự ghi)' as entry_description, jsonb_strip_nulls(jsonb_build_object(
  'failedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'source', :'source',
  'location', nullif(:'location', ''),
  'repoDir', nullif(:'repo', ''),
  'message', left(:'message', 500)
))::text as entry \gset
\endif
begin;
insert into site_settings (key, value, description) values (:'entry_key', :'entry'::jsonb, :'entry_description')
on conflict (key) do update set value = excluded.value, updated_at = now(), version = site_settings.version + 1;
insert into site_settings (key, value, description)
values ('system.backup.history', jsonb_build_array(:'entry'::jsonb), 'Các lần sao lưu gần đây, mới nhất trước (script sao lưu tự ghi, giữ 30 lần)')
on conflict (key) do update set
  value = (select coalesce(jsonb_agg(item order by position), '[]'::jsonb)
    from jsonb_array_elements(excluded.value || case when jsonb_typeof(site_settings.value) = 'array' then site_settings.value else '[]'::jsonb end)
      with ordinality as t(item, position)
    where position <= 30),
  updated_at = now(), version = site_settings.version + 1;
commit;
