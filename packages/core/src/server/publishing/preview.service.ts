import { findAdminOfferingById } from "../offerings/offerings.repository";
import { getFixedWebsitePage } from "../pages/pages.contract";
import { findAdminPageById } from "../pages/pages.repository";
import { findAdminPostById } from "../posts/posts.repository";
import { createPreviewToken, verifyPreviewToken, type PreviewKind } from "./preview-token";

const catalogPrefixes = { software: "/phan-mem", solution: "/giai-phap", service: "/dich-vu" } as const;

/** Đường dẫn công khai của nội dung (kể cả khi đang là bản nháp); không có → undefined. */
export async function previewPath(kind: PreviewKind, id: string): Promise<string | undefined> {
  if (kind === "post") {
    const post = await findAdminPostById(id);
    return post ? `${post.type === "guide" ? "/ho-tro/cai-dat" : "/tin-tuc"}/${post.slug}` : undefined;
  }
  if (kind === "page") {
    const page = await findAdminPageById(id);
    return page ? getFixedWebsitePage(page.slug)?.publicPath ?? `/trang/${page.slug}` : undefined;
  }
  const offering = await findAdminOfferingById(id);
  const prefix = offering ? catalogPrefixes[offering.type as keyof typeof catalogPrefixes] : undefined;
  return offering && prefix ? `${prefix}/${offering.slug}` : undefined;
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
