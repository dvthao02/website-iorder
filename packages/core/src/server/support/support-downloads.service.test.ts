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

function createRepository(options: { mimeType?: string; initial?: Partial<AdminSupportDownloadInput> & { draftVersion?: number; archivedAt?: Date | null } } = {}) {
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
    async findAdminSupportDownloadById(id) {
      return id === downloadId ? current : undefined;
    },
    async findMediaAsset(id) {
      if (id !== fileId || !options.mimeType) return undefined;
      return { id, mimeType: options.mimeType } as Awaited<ReturnType<typeof import("@iorder/core/server/media/media.repository").findMediaAsset>>;
    },
    async listAdminSupportDownloads() {
      return current ? [current] : [];
    },
    async listEnabledSupportDownloads() {
      return [];
    },
    async setSupportDownloadArchived(id, archived, _userId, expectedVersion) {
      if (!current || id !== downloadId || (expectedVersion !== undefined && expectedVersion !== current.draftVersion)) return undefined;
      current = { ...current, archivedAt: archived ? new Date("2026-10-02T00:00:00.000Z") : null, isEnabled: false, draftVersion: current.draftVersion + 1 };
      return downloadId;
    },
    async updateSupportDownloadWithRevision(id, values, revision) {
      if (!current || id !== downloadId || current.draftVersion !== revision.versionNumber - 1) return undefined;
      current = { ...current, ...values, draftVersion: revision.versionNumber };
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
