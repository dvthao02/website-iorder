// Lệnh sao lưu/phục hồi hiện trên trang "Sao lưu & phục hồi", điền sẵn đường dẫn do script sao lưu ghi lại.
// Phải khớp scripts/backup.ps1, scripts/backup.sh và mục Production trong docs/PROJECT.md.

export type BackupSource = "vps" | "windows";
export type RestorableBackup = { source: BackupSource; location: string; repoDir: string; stamp: string; database: string };
export type BackupStep = { title: string; detail: string; command: string };

const vpsCompose = "docker compose --env-file .env.production -f compose.production.yaml";
// Đường dẫn trong lệnh luôn đặt trong nháy kép: thư mục có dấu cách vẫn chạy đúng.
const quoted = (path: string) => `"${path}"`;

export function restoreSteps(backup: RestorableBackup): BackupStep[] {
  if (backup.source === "windows") {
    const dump = `${backup.location}\\db\\${backup.stamp}\\${backup.database}.dump`;
    return [
      { title: "Sao lưu dữ liệu hiện tại trước", detail: "Phục hồi ghi đè toàn bộ dữ liệu đang có. Sao lưu lại trước để còn đường quay về.", command: `cd ${quoted(backup.repoDir)}\npnpm backup:local` },
      { title: "Dừng website và CMS, chỉ để database chạy", detail: "Database đang có kết nối thì không xóa để nạp lại được.", command: "pnpm dev:stop\ndocker compose up -d --wait db storage" },
      { title: "Phục hồi database", detail: "Xóa database hiện tại rồi nạp lại từ bản đã chọn.", command: `docker compose cp ${quoted(dump)} db:/tmp/restore.dump\ndocker compose exec -T db sh -c 'dropdb -U $POSTGRES_USER $POSTGRES_DB && createdb -U $POSTGRES_USER $POSTGRES_DB && pg_restore -U $POSTGRES_USER --no-owner --exit-on-error -d $POSTGRES_DB /tmp/restore.dump && rm /tmp/restore.dump'` },
      { title: "Phục hồi ảnh và tệp media", detail: "Chỉ đưa lên tệp còn thiếu, không ghi đè tệp đang có.", command: `node --env-file=.env scripts/backup-media.mjs restore ${quoted(`${backup.location}\\media`)}` },
      { title: "Chạy lại và kiểm tra", detail: "Mở website, đăng nhập CMS và xem vài trang có ảnh.", command: "pnpm dev:all" },
    ];
  }
  const folder = `${backup.location}/db/${backup.stamp}`;
  return [
    { title: "Sao lưu dữ liệu hiện tại trước", detail: "Phục hồi ghi đè toàn bộ dữ liệu đang có. Sao lưu lại trước để còn đường quay về.", command: `cd ${quoted(backup.repoDir)}\nscripts/backup.sh` },
    { title: "Kiểm tra bản sao lưu còn nguyên vẹn", detail: "Mỗi tệp phải báo OK.", command: `(cd ${quoted(folder)} && sha256sum -c SHA256SUMS)` },
    { title: "Dừng website và CMS", detail: "Database đang có kết nối thì không xóa để nạp lại được.", command: `${vpsCompose} stop backend cms publish-web` },
    { title: "Phục hồi database", detail: "Xóa database hiện tại rồi nạp lại từ bản đã chọn.", command: `${vpsCompose} exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB" && pg_restore -U "$POSTGRES_USER" --no-owner --exit-on-error -d "$POSTGRES_DB"' < ${quoted(`${folder}/${backup.database}.dump`)}` },
    { title: "Phục hồi ảnh và tệp media", detail: "Chỉ đưa lên tệp còn thiếu, không ghi đè tệp đang có.", command: `${vpsCompose} run --rm --no-deps -v ${quoted(`${backup.location}/media:/backup/media`)} backup-media node scripts/backup-media.mjs restore /backup/media` },
    { title: "Chạy lại và kiểm tra", detail: "Mở website, đăng nhập CMS và xem vài trang có ảnh.", command: `${vpsCompose} up -d` },
  ];
}

/** Chạy tay và lên lịch hằng ngày; repoDir null khi máy đó chưa sao lưu lần nào (giữ chỗ để người dùng tự điền). */
export function scheduleSteps(source: BackupSource, repoDir: string | null): BackupStep[] {
  const repo = repoDir ?? (source === "windows" ? "D:\\duong-dan\\repo" : "/srv/iorder");
  if (source === "windows") {
    return [
      { title: "Sao lưu ngay", detail: "Cần Docker Desktop và container db, storage đang chạy (pnpm dev:all bật sẵn).", command: `cd ${quoted(repo)}\npnpm backup:local` },
      // --% để PowerShell chuyển nguyên phần sau cho schtasks; \" là nháy kép bên trong /TR (đường dẫn có dấu cách).
      { title: "Tự sao lưu mỗi tối 21:00", detail: "Tạo tác vụ trong Task Scheduler của Windows. Lúc đó máy phải bật và Docker Desktop đang chạy; hôm nào bỏ lỡ thì CMS báo quá hạn.", command: `schtasks --% /Create /SC DAILY /ST 21:00 /TN "iOrder sao luu" /TR "powershell -NoProfile -ExecutionPolicy Bypass -File \\"${repo}\\scripts\\backup.ps1\\""` },
    ];
  }
  return [
    { title: "Sao lưu ngay", detail: "Chạy trên VPS, trong thư mục repo.", command: `cd ${quoted(repo)}\nscripts/backup.sh` },
    { title: "Tự sao lưu mỗi đêm 2:30", detail: "Thêm dòng này bằng crontab -e của tài khoản chạy Docker.", command: `30 2 * * * cd ${quoted(repo)} && scripts/backup.sh >> /var/log/iorder-backup.log 2>&1` },
  ];
}
