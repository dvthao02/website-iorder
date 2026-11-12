// Lệnh sao lưu/phục hồi thủ công cho máy chủ thật (VPS — chưa triển khai, xem docs/ROADMAP.md). Trên máy
// Windows (môi trường đang chạy), CMS tự làm qua nút bấm (xem backup-manager.tsx, API /api/admin/backup),
// không cần các lệnh này. Phải khớp scripts/backup.sh và mục Production trong docs/PROJECT.md.

export type RestorableVpsBackup = { location: string; repoDir: string; stamp: string; database: string };
export type BackupStep = { title: string; detail: string; command: string };

const vpsCompose = "docker compose --env-file .env.production -f compose.production.yaml";
// Đường dẫn trong lệnh luôn đặt trong nháy kép: thư mục có dấu cách vẫn chạy đúng.
const quoted = (path: string) => `"${path}"`;

export function vpsRestoreSteps(backup: RestorableVpsBackup): BackupStep[] {
  const folder = `${backup.location}/db/${backup.stamp}`;
  return [
    { title: "Sao lưu dữ liệu hiện tại trước", detail: "Phục hồi ghi đè toàn bộ dữ liệu đang có. Sao lưu lại trước để còn đường quay về.", command: `cd ${quoted(backup.repoDir)}\nscripts/backup.sh` },
    { title: "Kiểm tra bản sao lưu còn nguyên vẹn", detail: "Mỗi tệp phải báo OK.", command: `(cd ${quoted(folder)} && sha256sum -c SHA256SUMS)` },
    { title: "Dừng website và CMS", detail: "Database đang có kết nối thì không xóa để nạp lại được.", command: `${vpsCompose} stop api admin website` },
    { title: "Phục hồi database", detail: "Xóa database hiện tại rồi nạp lại từ bản đã chọn.", command: `${vpsCompose} exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d "$POSTGRES_DB"' < ${quoted(`${folder}/${backup.database}.dump`)}` },
    { title: "Phục hồi ảnh và tệp media", detail: "Chỉ đưa lên tệp còn thiếu, không ghi đè tệp đang có.", command: `${vpsCompose} run --rm --no-deps -v ${quoted(`${backup.location}/media:/backup/media`)} backup-media node scripts/backup-media.mjs restore /backup/media` },
    { title: "Chạy lại và kiểm tra", detail: "Mở website, đăng nhập CMS và xem vài trang có ảnh.", command: `${vpsCompose} up -d` },
  ];
}

/** repoDir null khi máy chủ chưa sao lưu lần nào (giữ chỗ để người dùng tự điền). */
export function vpsScheduleSteps(repoDir: string | null): BackupStep[] {
  const repo = repoDir ?? "/srv/iorder";
  return [
    { title: "Sao lưu ngay", detail: "Chạy trên VPS, trong thư mục repo.", command: `cd ${quoted(repo)}\nscripts/backup.sh` },
    { title: "Tự sao lưu mỗi đêm 2:30", detail: "Thêm dòng này bằng crontab -e của tài khoản chạy Docker.", command: `30 2 * * * cd ${quoted(repo)} && scripts/backup.sh >> /var/log/iorder-backup.log 2>&1` },
  ];
}
