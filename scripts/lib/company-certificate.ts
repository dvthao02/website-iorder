import { readFile } from "node:fs/promises";
import path from "node:path";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "../../packages/shared/src/db/client";
import { mediaAssets } from "../../packages/shared/src/db/schema";
import { editAdminMedia, uploadAdminMedia } from "../../packages/shared/src/server/media/media.service";
import { companyProfileCertificateAlt } from "./company-profile-page";

const certificateName = "giay-chung-nhan-quyen-tac-gia.jpg";
const certificateFile = path.join(__dirname, "..", "data", "company-documents", certificateName);

// Ảnh giấy chứng nhận quyền tác giả trong thư viện media. Đã có (tải lên tay hoặc từ lần chạy trước) thì dùng lại, không tải bản trùng.
export async function ensureCertificateMedia(userId: string): Promise<string> {
  const [existing] = await getDb().select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.originalName, certificateName), isNull(mediaAssets.deletedAt))).limit(1);
  if (existing) return existing.id;
  const asset = await uploadAdminMedia(new File([await readFile(certificateFile)], certificateName, { type: "image/jpeg" }), userId);
  await editAdminMedia(asset.id, { altText: companyProfileCertificateAlt, caption: null, expectedVersion: asset.version }, userId);
  return asset.id;
}
