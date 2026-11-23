import { and, eq, inArray, isNull, ne, notLike, sql } from "drizzle-orm";
import { getDb } from "@iorder/shared/db/client";
import { auditLogs, menuItems, menus, offerings, pageBlocks, pages, posts, salesEquipment, siteSettings } from "@iorder/shared/db/schema";
import type { LinkUpdatePlace, LinkUpdateSummary } from "./redirects.contract";

export type { LinkUpdatePlace, LinkUpdateSummary };

export type DbTransaction = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// Chuyển hướng A → B xong thì mọi liên kết nội bộ đang trỏ tới A trong nội dung được đổi thẳng sang B,
// để khách không phải đi qua một bước chuyển hướng (chậm hơn, và Google coi liên kết trong site tới URL đã chuyển là lỗi cấu trúc).
// Phần thuần (không đụng DB) ở trên, phần ghi DB ở `rewriteInternalLinks`.

export type LinkMove = { from: string; to: string };
type PreparedMove = { from: string; path: string; hash: string };

function prepare(move: LinkMove): PreparedMove {
  const destination = new URL(move.to, "https://redirect.invalid");
  return { from: move.from, path: destination.pathname, hash: destination.hash };
}

// Chỉ trường chứa địa chỉ liên kết: `href` (nút, thẻ, liên kết trong bài viết), `url`, `link` và các tên kết thúc bằng Href/Url/Link (ctaHref…).
// Giới hạn theo tên trường để không đụng chữ thường như đơn vị giá "/tháng" hay nội dung văn bản tình cờ giống một đường dẫn.
const linkKey = /^(?:href|url|link|.+(?:Href|Url|Link))$/;

function rewritePrepared(value: string, move: PreparedMove): string | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  const cut = value.search(/[?#]/);
  const path = cut < 0 ? value : value.slice(0, cut);
  if (path !== move.from) return null;
  const tail = cut < 0 ? "" : value.slice(cut);
  const hashAt = tail.indexOf("#");
  const search = hashAt < 0 ? tail : tail.slice(0, hashAt);
  const hash = hashAt < 0 ? "" : tail.slice(hashAt);
  // Giống website khi chuyển hướng: giữ query của khách; neo (#) của đích ưu tiên, không có thì giữ neo của liên kết.
  return `${move.path}${search}${move.hash || hash}`;
}

/** Đường dẫn mới của một liên kết nội bộ nếu nó trỏ đúng tới `move.from` (kể cả kèm ?query hoặc #neo); null nếu không liên quan. */
export function rewriteLink(value: string, move: LinkMove): string | null {
  return rewritePrepared(value, prepare(move));
}

function walk(value: unknown, move: PreparedMove, key: string): { value: unknown; links: number } {
  if (typeof value === "string") {
    if (!linkKey.test(key)) return { value, links: 0 };
    const next = rewritePrepared(value, move);
    return next === null || next === value ? { value, links: 0 } : { value: next, links: 1 };
  }
  if (Array.isArray(value)) {
    let links = 0;
    let changed = false;
    const items = value.map((item) => {
      const result = walk(item, move, key);
      links += result.links;
      if (result.value !== item) changed = true;
      return result.value;
    });
    return { value: changed ? items : value, links };
  }
  if (value && typeof value === "object") {
    let links = 0;
    let changed = false;
    const entries = Object.entries(value).map(([name, item]) => {
      const result = walk(item, move, name);
      links += result.links;
      if (result.value !== item) changed = true;
      return [name, result.value] as const;
    });
    return { value: changed ? Object.fromEntries(entries) : value, links };
  }
  return { value, links: 0 };
}

/** Đổi mọi liên kết nội bộ trỏ tới `move.from` trong một cây JSON (khối trang, nội dung bài, cấu hình). Không sửa bản gốc; không đổi gì thì trả lại đúng đối tượng cũ. */
export function rewriteLinksInJson<T>(value: T, move: LinkMove): { value: T; links: number } {
  const result = walk(value, prepare(move), "");
  return { value: result.value as T, links: result.links };
}

export const noLinkUpdates: LinkUpdateSummary = { links: 0, places: [] };

/** Nội dung đang được lưu (đã tự cập nhật phiên bản): bỏ qua khi quét, để không đụng vào bản đang ghi. */
export type SkippedContent = { kind: "page" | "post" | "offering" | "equipment"; id: string };

// Lọc nhanh ở SQL trước khi duyệt JSON bằng mã: chỉ lấy dòng có chứa chính đường dẫn cũ.
const mentions = (column: unknown, path: string) => sql`strpos(${column}::text, ${path}) > 0`;

/**
 * Đổi liên kết trỏ tới `move.from` thành `move.to` ở menu (mục URL tùy chỉnh), khối trang, bài viết, sản phẩm/giải pháp/dịch vụ,
 * thiết bị và cấu hình website. Chạy trong transaction của lần lưu chuyển hướng/nội dung nên cùng thành công hoặc cùng hoàn tác.
 * Nội dung bị sửa tăng số phiên bản để tab đang soạn bản cũ nhận lỗi xung đột (409) thay vì ghi đè lại liên kết cũ.
 * Lịch sử phiên bản (revision) giữ nguyên; ghi một dòng nhật ký hoạt động tóm tắt.
 */
export async function rewriteInternalLinks(tx: DbTransaction, move: LinkMove, context: { userId: string; redirectId: string; skip?: SkippedContent }): Promise<LinkUpdateSummary> {
  const prepared = prepare(move);
  const now = new Date();
  const places: LinkUpdatePlace[] = [];
  const skipped = (kind: SkippedContent["kind"]) => context.skip?.kind === kind ? context.skip.id : null;
  const add = (label: string, items: number, links: number) => { if (items > 0) places.push({ label, items, links }); };

  // Menu: chỉ mục "URL tùy chỉnh"; mục liên kết tới nội dung tự theo đường dẫn hiện tại của nội dung đó.
  {
    const rows = await tx.select({ id: menuItems.id, menuId: menuItems.menuId, url: menuItems.url }).from(menuItems).where(and(eq(menuItems.linkType, "custom"), sql`strpos(${menuItems.url}, ${move.from}) = 1`));
    const menuIds = new Set<string>();
    let items = 0;
    for (const row of rows) {
      const url = rewritePrepared(row.url, prepared);
      if (url === null) continue;
      await tx.update(menuItems).set({ url, updatedAt: now }).where(eq(menuItems.id, row.id));
      menuIds.add(row.menuId);
      items += 1;
    }
    if (menuIds.size) await tx.update(menus).set({ version: sql`${menus.version} + 1`, updatedAt: now }).where(inArray(menus.id, [...menuIds]));
    add("Menu", items, items);
  }

  // Trang website: khối nằm ở bảng riêng, phiên bản nằm ở trang.
  {
    const skipId = skipped("page");
    const rows = await tx.select({ id: pageBlocks.id, pageId: pageBlocks.pageId, data: pageBlocks.data }).from(pageBlocks).innerJoin(pages, eq(pages.id, pageBlocks.pageId))
      .where(and(isNull(pages.deletedAt), mentions(pageBlocks.data, move.from), ...(skipId ? [ne(pages.id, skipId)] : [])));
    const pageIds = new Set<string>();
    let links = 0;
    for (const row of rows) {
      const result = rewriteLinksInJson(row.data, move);
      if (!result.links) continue;
      await tx.update(pageBlocks).set({ data: result.value, updatedAt: now }).where(eq(pageBlocks.id, row.id));
      pageIds.add(row.pageId);
      links += result.links;
    }
    if (pageIds.size) await tx.update(pages).set({ draftVersion: sql`${pages.draftVersion} + 1`, updatedAt: now }).where(inArray(pages.id, [...pageIds]));
    add("Trang website", pageIds.size, links);
  }

  // Bài viết và hướng dẫn: nội dung soạn thảo + nút kêu gọi ở cuối bài.
  {
    const skipId = skipped("post");
    const rows = await tx.select({ id: posts.id, content: posts.content, ctaUrl: posts.ctaUrl }).from(posts)
      .where(and(isNull(posts.deletedAt), sql`(${mentions(posts.content, move.from)} or strpos(${posts.ctaUrl}, ${move.from}) = 1)`, ...(skipId ? [ne(posts.id, skipId)] : [])));
    let items = 0;
    let links = 0;
    for (const row of rows) {
      const content = rewriteLinksInJson(row.content, move);
      const ctaUrl = row.ctaUrl === null ? null : rewritePrepared(row.ctaUrl, prepared);
      const count = content.links + (ctaUrl === null ? 0 : 1);
      if (!count) continue;
      await tx.update(posts).set({ content: content.value, ctaUrl: ctaUrl ?? row.ctaUrl, draftVersion: sql`${posts.draftVersion} + 1`, updatedAt: now }).where(eq(posts.id, row.id));
      items += 1;
      links += count;
    }
    add("Bài viết", items, links);
  }

  // Phần mềm / giải pháp / dịch vụ.
  {
    const skipId = skipped("offering");
    const rows = await tx.select({ id: offerings.id, content: offerings.content }).from(offerings)
      .where(and(isNull(offerings.deletedAt), mentions(offerings.content, move.from), ...(skipId ? [ne(offerings.id, skipId)] : [])));
    let items = 0;
    let links = 0;
    for (const row of rows) {
      const content = rewriteLinksInJson(row.content, move);
      if (!content.links) continue;
      await tx.update(offerings).set({ content: content.value, draftVersion: sql`${offerings.draftVersion} + 1`, updatedAt: now }).where(eq(offerings.id, row.id));
      items += 1;
      links += content.links;
    }
    add("Phần mềm, giải pháp, dịch vụ", items, links);
  }

  // Thiết bị bán.
  {
    const skipId = skipped("equipment");
    const rows = await tx.select({ id: salesEquipment.id, blocks: salesEquipment.blocks, pageLayout: salesEquipment.pageLayout }).from(salesEquipment)
      .where(and(isNull(salesEquipment.deletedAt), sql`(${mentions(salesEquipment.blocks, move.from)} or ${mentions(salesEquipment.pageLayout, move.from)})`, ...(skipId ? [ne(salesEquipment.id, skipId)] : [])));
    let items = 0;
    let links = 0;
    for (const row of rows) {
      const blocks = rewriteLinksInJson(row.blocks, move);
      const pageLayout = rewriteLinksInJson(row.pageLayout, move);
      const count = blocks.links + pageLayout.links;
      if (!count) continue;
      await tx.update(salesEquipment).set({ blocks: blocks.value, pageLayout: pageLayout.value, draftVersion: sql`${salesEquipment.draftVersion} + 1`, updatedAt: now }).where(eq(salesEquipment.id, row.id));
      items += 1;
      links += count;
    }
    add("Thiết bị", items, links);
  }

  // Cấu hình website (liên kết của quảng cáo, nội dung danh mục…); bỏ qua khóa hệ thống (lịch sử sao lưu, trạng thái chạy nền).
  {
    const rows = await tx.select({ id: siteSettings.id, value: siteSettings.value }).from(siteSettings).where(and(notLike(siteSettings.key, "system.%"), mentions(siteSettings.value, move.from)));
    let items = 0;
    let links = 0;
    for (const row of rows) {
      const value = rewriteLinksInJson(row.value, move);
      if (!value.links) continue;
      await tx.update(siteSettings).set({ value: value.value, version: sql`${siteSettings.version} + 1`, updatedAt: now }).where(eq(siteSettings.id, row.id));
      items += 1;
      links += value.links;
    }
    add("Cấu hình website", items, links);
  }

  const summary = { links: places.reduce((total, place) => total + place.links, 0), places };
  if (summary.links) {
    await tx.insert(auditLogs).values({ userId: context.userId, action: "redirect.rewrite_links", entityType: "redirect", entityId: context.redirectId, afterData: { from: move.from, to: move.to, ...summary } });
  }
  return summary;
}
