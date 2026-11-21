import { findAdminOfferingById } from "../offerings/offerings.repository";
import { offeringPublicPath, pagePublicPath, postPublicPath } from "../shared/content-paths";
import { findAdminPageById } from "../pages/pages.repository";
import { findAdminPostById } from "../posts/posts.repository";
import { createPreviewToken, verifyPreviewToken, type PreviewKind } from "./preview-token";
import { findBuilderPreview } from "./builder-preview.repository";

/** Đường dẫn công khai của nội dung (kể cả khi đang là bản nháp); không có → undefined. */
export async function previewPath(kind: PreviewKind, id: string): Promise<string | undefined> {
  if (kind === "builder") {
    const preview = await findBuilderPreview(id);
    if (!preview) return undefined;
    return preview.document.kind === "page" ? pagePublicPath(preview.document.values.slug) : preview.document.kind === "equipment" ? `/thiet-bi/${preview.document.values.slug}` : offeringPublicPath(preview.document.values.slug, preview.document.values.type) ?? undefined;
  }
  if (kind === "post") {
    const post = await findAdminPostById(id);
    return post ? postPublicPath(post.slug, post.type) : undefined;
  }
  if (kind === "page") {
    const page = await findAdminPageById(id);
    return page ? pagePublicPath(page.slug) : undefined;
  }
  const offering = await findAdminOfferingById(id);
  return offering ? offeringPublicPath(offering.slug, offering.type) ?? undefined : undefined;
}

/** CMS xin xem trước: token ký kèm đường dẫn để mở trên website. */
export async function issuePreview(kind: PreviewKind, id: string) {
  const path = await previewPath(kind, id);
  return path ? { token: createPreviewToken(kind, id), path } : undefined;
}

/** Website kiểm token trước khi bật chế độ xem trước; đường dẫn lấy từ dữ liệu hiện tại, không tin tham số URL. */
export async function resolvePreview(token: string | null | undefined) {
  const claims = verifyPreviewToken(token);
  if (!claims) return undefined;
  const path = await previewPath(claims.kind, claims.id);
  return path ? { ...claims, path } : undefined;
}
