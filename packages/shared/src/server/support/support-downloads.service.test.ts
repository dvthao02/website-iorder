import assert from "node:assert/strict";
import test from "node:test";

import type { AdminSupportDownloadInput } from "./support-downloads.contract";
import {
  createSupportDownloadsService,
  SupportDownloadVersionConflictError,
} from "./support-downloads.service";

const downloadId = "11111111-1111-4111-8111-111111111111";
const fileId = "22222222-2222-4222-8222-222222222222";
const editorId = "33333333-3333-4333-8333-333333333333";

const draftValues: AdminSupportDownloadInput = {
  fileMediaId: null,
  externalUrl: null,
  groupName: null,
  icon: "download",
  title: "Bộ cài đặt iOrder",
  description: null,
  meta: null,
  sortOrder: 0,
  isEnabled: false,
};

type TestAdminRow = AdminSupportDownloadInput & {
  archivedAt: Date | null;
  draftVersion: number;
  id: string;
  mimeType: string | null;
  originalName: string | null;
  storageKey: string | null;
};

function createRepository(options: { mimeType?: string; enabledRows?: unknown[]; initial?: Partial<AdminSupportDownloadInput> & { draftVersion?: number; archivedAt?: Date | null } } = {}) {
  let current: TestAdminRow | undefined = options.initial
    ? {
        ...draftValues,
        ...options.initial,
        id: downloadId,
        originalName: "tai-lieu.pdf",
        mimeType: options.mimeType ?? "application/pdf",
        storageKey: "uploads/tai-lieu.pdf",
        draftVersion: options.initial.draftVersion ?? 1,
        archivedAt: options.initial.archivedAt ?? null,
      }
    : undefined;
  const revisionWrites: { versionNumber: number; changeNote: string }[] = [];

  const repository = {
    async createSupportDownloadWithRevision(values, revision) {
      current = {
        ...values,
        id: downloadId,
        originalName: values.fileMediaId ? "tai-lieu.pdf" : null,
        mimeType: values.fileMediaId ? options.mimeType ?? "application/pdf" : null,
        storageKey: values.fileMediaId ? "uploads/tai-lieu.pdf" : null,
        draftVersion: revision.versionNumber,
        archivedAt: null,
      };
      revisionWrites.push(revision);
      return downloadId;
    },
    async deleteArchivedSupportDownload(id, _userId, expectedVersion) {
      if (!current || id !== downloadId || !current.archivedAt || (expectedVersion !== undefined && expectedVersion !== current.draftVersion)) return undefined;
      current = undefined;
      return downloadId;
    },
    async findAdminSupportDownloadById(id) {
      return id === downloadId ? current : undefined;
    },
    async findMediaAsset(id) {
      if (id !== fileId || !options.mimeType) return undefined;
      return { id, mimeType: options.mimeType } as Awaited<ReturnType<typeof import("@iorder/shared/server/media/media.repository").findMediaAsset>>;
    },
    async listAdminSupportDownloads() {
      return current ? [current] : [];
    },
    async listEnabledSupportDownloads() {
      return (options.enabledRows ?? []) as Awaited<ReturnType<typeof import("./support-downloads.repository").listEnabledSupportDownloads>>;
    },
    async setSupportDownloadArchived(id, archived, _userId, expectedVersion) {
      if (!current || id !== downloadId || (expectedVersion !== undefined && expectedVersion !== current.draftVersion)) return undefined;
      current = { ...current, archivedAt: archived ? new Date("2026-10-02T00:00:00.000Z") : null, isEnabled: false, draftVersion: current.draftVersion + 1 };
      return downloadId;
    },
    async updateSupportDownloadWithRevision(id, values, revision) {
      if (!current || id !== downloadId || current.draftVersion !== revision.versionNumber - 1) return undefined;
      // Repository thật lấy tên và khóa lưu trữ từ phép nối với tệp: đổi nguồn thì các trường này đổi theo.
      current = { ...current, ...values, originalName: values.fileMediaId ? "tai-lieu.pdf" : null, mimeType: values.fileMediaId ? options.mimeType ?? "application/pdf" : null, storageKey: values.fileMediaId ? "uploads/tai-lieu.pdf" : null, draftVersion: revision.versionNumber };
      revisionWrites.push(revision);
      return downloadId;
    },
  } as Parameters<typeof createSupportDownloadsService>[0];

  return { current: () => current, repository, revisionWrites };
}

test("cho phép lưu bản nháp khi chưa chọn tệp", async () => {
  const fake = createRepository();
  const service = createSupportDownloadsService(fake.repository);

  const created = await service.createAdminSupportDownload(draftValues, editorId);

  assert.equal(created.status, "draft");
  assert.equal(created.fileMediaId, null);
});

test("bắt buộc phải có tệp khi hiển thị công khai", async () => {
  const fake = createRepository();
  const service = createSupportDownloadsService(fake.repository);

  await assert.rejects(service.createAdminSupportDownload({ ...draftValues, isEnabled: true }, editorId));
});

test("nhận tệp nén và tài liệu Office làm tệp tải xuống, không nhận tệp chạy được", async () => {
  for (const mimeType of ["application/vnd.rar", "application/x-7z-compressed", "application/gzip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]) {
    await createSupportDownloadsService(createRepository({ mimeType }).repository).createAdminSupportDownload({ ...draftValues, fileMediaId: fileId }, editorId);
  }
  for (const mimeType of ["application/x-msdownload", "application/x-msi", "image/svg+xml"]) {
    await assert.rejects(createSupportDownloadsService(createRepository({ mimeType }).repository).createAdminSupportDownload({ ...draftValues, fileMediaId: fileId }, editorId), mimeType);
  }
});

test("chỉ chấp nhận PDF hoặc ZIP làm tệp tải xuống", async () => {
  const pdf = createSupportDownloadsService(createRepository({ mimeType: "application/pdf" }).repository);
  const zip = createSupportDownloadsService(createRepository({ mimeType: "application/zip" }).repository);
  const image = createSupportDownloadsService(createRepository({ mimeType: "image/png" }).repository);

  await pdf.createAdminSupportDownload({ ...draftValues, fileMediaId: fileId }, editorId);
  await zip.createAdminSupportDownload({ ...draftValues, fileMediaId: fileId }, editorId);
  await assert.rejects(image.createAdminSupportDownload({ ...draftValues, fileMediaId: fileId }, editorId));
});

test("tạo và cập nhật đều ghi phiên bản với ghi chú", async () => {
  const fake = createRepository({ mimeType: "application/pdf" });
  const service = createSupportDownloadsService(fake.repository);

  await service.createAdminSupportDownload({ ...draftValues, fileMediaId: fileId }, editorId, "Tạo tài liệu");
  await service.updateAdminSupportDownload(downloadId, { ...draftValues, fileMediaId: fileId, title: "Bộ cài đặt mới" }, editorId, { expectedVersion: 1, changeNote: "Đổi tên" });

  assert.deepEqual(fake.revisionWrites.map(({ versionNumber, changeNote }) => ({ versionNumber, changeNote })), [
    { versionNumber: 1, changeNote: "Tạo tài liệu" },
    { versionNumber: 2, changeNote: "Đổi tên" },
  ]);
});

test("từ chối lưu khi version từ trình duyệt đã cũ", async () => {
  const fake = createRepository({ mimeType: "application/pdf", initial: { fileMediaId: fileId, draftVersion: 3 } });
  const service = createSupportDownloadsService(fake.repository);

  await assert.rejects(
    service.updateAdminSupportDownload(downloadId, { ...draftValues, fileMediaId: fileId }, editorId, { expectedVersion: 2 }),
    SupportDownloadVersionConflictError,
  );
});

test("lưu trữ và khôi phục đều tăng version, khôi phục về bản nháp", async () => {
  const fake = createRepository({ mimeType: "application/pdf", initial: { fileMediaId: fileId, isEnabled: true } });
  const service = createSupportDownloadsService(fake.repository);

  const archived = await service.changeSupportDownloadArchiveState(downloadId, true, editorId, 1);
  const restored = await service.changeSupportDownloadArchiveState(downloadId, false, editorId, 2);

  assert.equal(archived?.status, "archived");
  assert.equal(restored?.status, "draft");
  assert.equal(restored?.draftVersion, 3);
  assert.equal(restored?.isEnabled, false);
});

test("chỉ xóa được tài nguyên đã lưu trữ và giữ kiểm tra phiên bản", async () => {
  const fake = createRepository({ mimeType: "application/pdf", initial: { fileMediaId: fileId, isEnabled: true } });
  const service = createSupportDownloadsService(fake.repository);

  assert.equal(await service.deleteArchivedAdminSupportDownload(downloadId, editorId, 1), undefined);
  await service.changeSupportDownloadArchiveState(downloadId, true, editorId, 1);
  await assert.rejects(service.deleteArchivedAdminSupportDownload(downloadId, editorId, 1), SupportDownloadVersionConflictError);
  assert.equal(await service.deleteArchivedAdminSupportDownload(downloadId, editorId, 2), downloadId);
  assert.equal(fake.current(), undefined);
});

test("hiển thị công khai được khi chỉ có link tải về (không cần tệp trong thư viện)", async () => {
  const fake = createRepository();
  const service = createSupportDownloadsService(fake.repository);

  const created = await service.createAdminSupportDownload({ ...draftValues, externalUrl: "https://example.com/tai-ve/iOrder-Setup.exe", isEnabled: true }, editorId);

  assert.equal(created.status, "published");
  assert.equal(created.fileMediaId, null);
  assert.equal(created.downloadUrl, "https://example.com/tai-ve/iOrder-Setup.exe");
});

test("mục chỉ có link vẫn cần nguồn: không tệp và không link thì không được hiển thị", async () => {
  const service = createSupportDownloadsService(createRepository().repository);

  await assert.rejects(service.createAdminSupportDownload({ ...draftValues, isEnabled: true }, editorId));
});

test("một mục chỉ dùng một nguồn: không được vừa có tệp vừa có link", async () => {
  const service = createSupportDownloadsService(createRepository({ mimeType: "application/pdf" }).repository);

  await assert.rejects(service.createAdminSupportDownload({ ...draftValues, fileMediaId: fileId, externalUrl: "https://example.com/a.zip" }, editorId));
});

test("từ chối link không phải https, có tài khoản hoặc sai định dạng", async () => {
  const service = createSupportDownloadsService(createRepository().repository);

  for (const externalUrl of ["http://example.com/a.zip", "javascript:alert(1)", "ftp://example.com/a.zip", "https://user:pass@example.com/a.zip", "example.com/a.zip", "https://"]) {
    await assert.rejects(service.createAdminSupportDownload({ ...draftValues, externalUrl }, editorId), externalUrl);
  }
});

test("đổi từ tệp sang link: mục cập nhật giữ link và bỏ tham chiếu tệp", async () => {
  const fake = createRepository({ mimeType: "application/pdf", initial: { fileMediaId: fileId, isEnabled: true } });
  const service = createSupportDownloadsService(fake.repository);

  const updated = await service.updateAdminSupportDownload(downloadId, { ...draftValues, fileMediaId: null, externalUrl: "https://example.com/a.zip", isEnabled: true }, editorId, { expectedVersion: 1 });

  assert.equal(updated?.fileMediaId, null);
  assert.equal(updated?.externalUrl, "https://example.com/a.zip");
  assert.equal(updated?.downloadUrl, "https://example.com/a.zip");
});

test("danh sách công khai gắn cờ external cho link ngoài và dùng đường dẫn /media cho tệp trong thư viện", async () => {
  const rows = [
    { id: downloadId, icon: "download", title: "Link ngoài", description: null, meta: null, storageKey: null, externalUrl: "https://example.com/setup.exe", groupName: null },
    { id: fileId, icon: "download", title: "Tệp trong thư viện", description: null, meta: null, storageKey: "uploads/a.zip", externalUrl: null, groupName: null },
  ];
  const service = createSupportDownloadsService(createRepository({ enabledRows: rows }).repository);

  const [external, internal] = await service.getEnabledSupportDownloads();

  assert.deepEqual({ url: external.downloadUrl, external: external.external }, { url: "https://example.com/setup.exe", external: true });
  assert.equal(internal.external, false);
  assert.ok(internal.downloadUrl.startsWith("/media/"));
});

test("nhóm hiển thị được lưu cùng mục và danh sách công khai mang theo tên nhóm (không nhóm là null)", async () => {
  const fake = createRepository();
  const service = createSupportDownloadsService(fake.repository);

  const created = await service.createAdminSupportDownload({ ...draftValues, externalUrl: "https://example.com/a.exe", groupName: "Driver trên Windows" }, editorId);
  assert.equal(created.groupName, "Driver trên Windows");

  const rows = [
    { id: downloadId, icon: "download", title: "A", description: null, meta: null, storageKey: null, externalUrl: "https://example.com/a.exe", groupName: "Driver trên Windows" },
    { id: fileId, icon: "download", title: "B", description: null, meta: null, storageKey: "uploads/b.zip", externalUrl: null, groupName: null },
  ];
  const [grouped, ungrouped] = await createSupportDownloadsService(createRepository({ enabledRows: rows }).repository).getEnabledSupportDownloads();
  assert.equal(grouped.groupName, "Driver trên Windows");
  assert.equal(ungrouped.groupName, null);
});
