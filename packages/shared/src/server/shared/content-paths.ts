import { getFixedWebsitePage } from "../pages/pages.contract";

// Đường dẫn công khai của từng loại nội dung: một chỗ duy nhất cho menu, xem trước và chuyển hướng khi đổi slug.
const catalogPrefixes: Record<string, string> = { software: "/phan-mem", solution: "/giai-phap", service: "/dich-vu" };

export function pagePublicPath(slug: string) {
  return getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}`;
}

export function postPublicPath(slug: string, type: string) {
  return type === "guide" ? `/ho-tro/huong-dan/${slug}` : `/tin-tuc/${slug}`;
}

export function offeringPublicPath(slug: string, type: string) {
  const prefix = catalogPrefixes[type];
  return prefix ? `${prefix}/${slug}` : null;
}

export function equipmentPublicPath(slug: string) {
  return `/thiet-bi/${slug}`;
}

type PathState = { status: string; scheduledAt?: Date | null; path: string | null };

// Hẹn giờ đã tới giờ được website coi như đã xuất bản (lọc lúc truy vấn).
function isLive(state: PathState, now: Date) {
  return state.status === "published" || (state.status === "scheduled" && Boolean(state.scheduledAt) && state.scheduledAt! <= now);
}

// Nội dung đang hiện trên website đổi đường dẫn và vẫn hiện sau khi lưu → URL cũ cần chuyển hướng sang URL mới.
// Gỡ khỏi website hoặc chưa từng xuất bản thì không có URL cũ nào đáng giữ (đích mới cũng chưa mở được).
export function movedContentPath(before: PathState | undefined, after: PathState, now = new Date()) {
  if (!before || !isLive(before, now) || !isLive(after, now)) return null;
  if (!before.path || !after.path || before.path === after.path) return null;
  return { from: before.path, to: after.path };
}

// Đường dẫn nội dung sẽ chiếm sau khi lưu: đã xuất bản hoặc hẹn giờ (tới giờ không có lần lưu nào để dọn chuyển hướng).
export function claimedContentPath(after: PathState) {
  return after.status === "published" || after.status === "scheduled" ? after.path : null;
}

export function contentPathChange(before: PathState | undefined, after: PathState, now = new Date()) {
  return { moved: movedContentPath(before, after, now), claimed: claimedContentPath(after) };
}
