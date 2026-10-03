import { z } from "zod";

import { findMediaAsset } from "@iorder/core/server/media/media.repository";
import { mediaPath } from "@iorder/core/server/media/storage";

import {
  adminSupportDownloadInputSchema,
  adminSupportDownloadSchema,
  publicSupportDownloadSchema,
} from "./support-downloads.contract";
import {
  createSupportDownloadWithRevision,
  findAdminSupportDownloadById,
  listAdminSupportDownloads,
  listEnabledSupportDownloads,
  setSupportDownloadArchived,
  updateSupportDownloadWithRevision,
} from "./support-downloads.repository";

const allowedDocumentTypes = new Set(["application/pdf", "application/zip"]);

export class SupportDownloadVersionConflictError extends Error {
  constructor() {
    super("Tài nguyên đã được cập nhật ở một phiên làm việc khác. Vui lòng tải lại trang trước khi lưu tiếp.");
  }
}

export class ArchivedSupportDownloadError extends Error {
  constructor() {
    super("Tài nguyên đang được lưu trữ. Hãy khôi phục trước khi chỉnh sửa.");
  }
}

type SupportDownloadsRepository = {
  createSupportDownloadWithRevision: typeof createSupportDownloadWithRevision;
  findAdminSupportDownloadById: typeof findAdminSupportDownloadById;
  listAdminSupportDownloads: typeof listAdminSupportDownloads;
  listEnabledSupportDownloads: typeof listEnabledSupportDownloads;
  setSupportDownloadArchived: typeof setSupportDownloadArchived;
  updateSupportDownloadWithRevision: typeof updateSupportDownloadWithRevision;
  findMediaAsset: typeof findMediaAsset;
};

type AdminRow = Exclude<Awaited<ReturnType<typeof findAdminSupportDownloadById>>, undefined>;

function serializeAdminSupportDownload(row: AdminRow) {
  const { storageKey, ...download } = row;
  return adminSupportDownloadSchema.parse({
    ...download,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    downloadUrl: storageKey ? mediaPath(storageKey) : null,
    status: row.archivedAt ? "archived" : row.isEnabled ? "published" : "draft",
  });
}

function fileValidationError(message: string) {
  return new z.ZodError([{ code: "custom", path: ["fileMediaId"], message }]);
}

export function createSupportDownloadsService(repository: SupportDownloadsRepository) {
  async function validateFile(fileMediaId: string | null, enabled: boolean) {
    if (!fileMediaId) {
      if (enabled) throw fileValidationError("Vui lòng chọn tệp trước khi hiển thị công khai.");
      return;
    }
    const asset = await repository.findMediaAsset(fileMediaId);
    if (!asset) throw fileValidationError("Tệp đã chọn không còn tồn tại trong thư viện.");
    if (!allowedDocumentTypes.has(asset.mimeType)) throw fileValidationError("Tài nguyên tải xuống chỉ nhận tệp PDF hoặc ZIP.");
  }

  async function getEnabledSupportDownloads() {
    const rows = await repository.listEnabledSupportDownloads();
    return rows.map((row) => publicSupportDownloadSchema.parse({
      id: row.id,
      icon: row.icon,
      title: row.title,
      description: row.description,
      meta: row.meta,
      downloadUrl: mediaPath(row.storageKey),
    }));
  }

  async function getAdminSupportDownloads() {
    return (await repository.listAdminSupportDownloads()).map(serializeAdminSupportDownload);
  }

  async function getAdminSupportDownloadById(id: string) {
    if (!z.string().uuid().safeParse(id).success) return undefined;
    const download = await repository.findAdminSupportDownloadById(id);
    return download ? serializeAdminSupportDownload(download) : undefined;
  }

  async function createAdminSupportDownload(input: unknown, editorId: string, changeNote?: string) {
    const values = adminSupportDownloadInputSchema.parse(input);
    await validateFile(values.fileMediaId, values.isEnabled);
    const id = await repository.createSupportDownloadWithRevision(values, {
      editorId,
      versionNumber: 1,
      snapshot: values,
      changeNote: changeNote?.trim() || "Tạo tài nguyên tải xuống",
    });
    const download = await repository.findAdminSupportDownloadById(id);
    if (!download) throw new Error("Không tìm thấy tài nguyên vừa tạo.");
    return serializeAdminSupportDownload(download);
  }

  async function updateAdminSupportDownload(
    id: string,
    input: unknown,
    editorId: string,
    options: { expectedVersion?: number; changeNote?: string; allowArchived?: boolean } = {},
  ) {
    const values = adminSupportDownloadInputSchema.parse(input);
    const existing = await repository.findAdminSupportDownloadById(id);
    if (!existing) return undefined;
    if (existing.archivedAt && !options.allowArchived) throw new ArchivedSupportDownloadError();
    if (options.expectedVersion !== undefined && options.expectedVersion !== existing.draftVersion) throw new SupportDownloadVersionConflictError();
    await validateFile(values.fileMediaId, values.isEnabled && !existing.archivedAt);

    const updatedId = await repository.updateSupportDownloadWithRevision(id, values, {
      editorId,
      versionNumber: existing.draftVersion + 1,
      snapshot: values,
      changeNote: options.changeNote?.trim() || "Cập nhật tài nguyên tải xuống",
    });
    if (!updatedId) throw new SupportDownloadVersionConflictError();
    const download = await repository.findAdminSupportDownloadById(updatedId);
    return download ? serializeAdminSupportDownload(download) : undefined;
  }

  async function changeSupportDownloadArchiveState(id: string, archived: boolean, editorId: string, expectedVersion?: number) {
    const existing = await repository.findAdminSupportDownloadById(id);
    if (!existing) return undefined;
    if (expectedVersion !== undefined && expectedVersion !== existing.draftVersion) throw new SupportDownloadVersionConflictError();
    const updatedId = await repository.setSupportDownloadArchived(id, archived, editorId, expectedVersion);
    if (!updatedId) throw new SupportDownloadVersionConflictError();
    const download = await repository.findAdminSupportDownloadById(updatedId);
    return download ? serializeAdminSupportDownload(download) : undefined;
  }

  return {
    changeSupportDownloadArchiveState,
    createAdminSupportDownload,
    getAdminSupportDownloadById,
    getAdminSupportDownloads,
    getEnabledSupportDownloads,
    updateAdminSupportDownload,
  };
}

const supportDownloadsService = createSupportDownloadsService({
  createSupportDownloadWithRevision,
  findAdminSupportDownloadById,
  findMediaAsset,
  listAdminSupportDownloads,
  listEnabledSupportDownloads,
  setSupportDownloadArchived,
  updateSupportDownloadWithRevision,
});

export const changeSupportDownloadArchiveState = supportDownloadsService.changeSupportDownloadArchiveState;
export const createAdminSupportDownload = supportDownloadsService.createAdminSupportDownload;
export const getAdminSupportDownloadById = supportDownloadsService.getAdminSupportDownloadById;
export const getAdminSupportDownloads = supportDownloadsService.getAdminSupportDownloads;
export const getEnabledSupportDownloads = supportDownloadsService.getEnabledSupportDownloads;
export const updateAdminSupportDownload = supportDownloadsService.updateAdminSupportDownload;
