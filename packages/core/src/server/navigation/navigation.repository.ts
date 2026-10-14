import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { auditLogs, equipmentGroups, menuItems, menuRevisions, menus, offerings, pages, posts, salesEquipment } from "@iorder/core/db/schema";
import { getFixedWebsitePage } from "@iorder/core/server/pages/pages.contract";

import type { NavigationDocument, NavigationItems, NavigationLinkType, NavigationLocation, NavigationTarget } from "./navigation.contract";

export class NavigationWriteConflictError extends Error {
  constructor() {
    super("NAVIGATION_VERSION_CONFLICT");
  }
}

function selectMenuItems(menuId: string) {
  return getDb().select().from(menuItems).where(eq(menuItems.menuId, menuId)).orderBy(asc(menuItems.sortOrder));
}

type MenuItemRows = Awaited<ReturnType<typeof selectMenuItems>>;

function serializeItems(rows: MenuItemRows): NavigationItems {
  return rows.map((row) => ({
    key: row.id,
    parentKey: row.parentId,
    label: row.label,
    url: row.url,
    linkType: row.linkType as NavigationLinkType,
    contentId: row.contentId,
    target: row.target as "_self" | "_blank",
    isEnabled: row.isEnabled,
  }));
}

function pagePath(slug: string) {
  return getFixedWebsitePage(slug)?.publicPath ?? `/trang/${slug}`;
}

function postPath(slug: string, type: string) {
  return type === "guide" ? `/ho-tro/cai-dat/${slug}` : `/tin-tuc/${slug}`;
}

function offeringPath(slug: string, type: string) {
  const catalog = type === "software" ? "phan-mem" : type === "solution" ? "giai-phap" : type === "service" ? "dich-vu" : null;
  return catalog ? `/${catalog}/${slug}` : null;
}

type TargetIds = Partial<Record<Exclude<NavigationLinkType, "custom">, string[]>>;

async function readPublishedNavigationTargets(ids?: TargetIds): Promise<NavigationTarget[]> {
  const now = new Date();
  const pagePublished = or(and(eq(pages.status, "published"), or(isNull(pages.publishedAt), lte(pages.publishedAt, now))), and(eq(pages.status, "scheduled"), lte(pages.scheduledAt, now)));
  const postPublished = or(and(eq(posts.status, "published"), or(isNull(posts.publishedAt), lte(posts.publishedAt, now))), and(eq(posts.status, "scheduled"), lte(posts.scheduledAt, now)));
  const offeringPublished = or(and(eq(offerings.status, "published"), or(isNull(offerings.publishedAt), lte(offerings.publishedAt, now))), and(eq(offerings.status, "scheduled"), lte(offerings.scheduledAt, now)));
  const equipmentPublished = or(and(eq(salesEquipment.status, "published"), or(isNull(salesEquipment.publishedAt), lte(salesEquipment.publishedAt, now))), and(eq(salesEquipment.status, "scheduled"), lte(salesEquipment.scheduledAt, now)));
  const pageIds = ids?.page;
  const postIds = ids?.post;
  const offeringIds = ids?.offering;
  const equipmentIds = ids?.equipment;
  const [pageRows, postRows, offeringRows, equipmentRows] = await Promise.all([
    getDb().select({ id: pages.id, title: pages.title, slug: pages.slug }).from(pages).where(and(isNull(pages.deletedAt), pagePublished, pageIds ? inArray(pages.id, pageIds) : undefined)),
    getDb().select({ id: posts.id, title: posts.title, slug: posts.slug, type: posts.type }).from(posts).where(and(isNull(posts.deletedAt), postPublished, postIds ? inArray(posts.id, postIds) : undefined)),
    getDb().select({ id: offerings.id, title: offerings.title, slug: offerings.slug, type: offerings.type }).from(offerings).where(and(isNull(offerings.deletedAt), offeringPublished, offeringIds ? inArray(offerings.id, offeringIds) : undefined)),
    getDb().select({ id: salesEquipment.id, name: salesEquipment.name, slug: salesEquipment.slug }).from(salesEquipment).innerJoin(equipmentGroups, eq(salesEquipment.groupId, equipmentGroups.id)).where(and(isNull(salesEquipment.deletedAt), isNull(equipmentGroups.deletedAt), eq(equipmentGroups.isEnabled, true), equipmentPublished, equipmentIds ? inArray(salesEquipment.id, equipmentIds) : undefined)),
  ]);

  return [
    ...pageRows.map((row) => ({ id: row.id, linkType: "page" as const, label: row.title, url: pagePath(row.slug), typeLabel: "Trang website" })),
    ...postRows.map((row) => ({ id: row.id, linkType: "post" as const, label: row.title, url: postPath(row.slug, row.type), typeLabel: row.type === "guide" ? "Hướng dẫn" : "Bài viết" })),
    ...offeringRows.flatMap((row) => {
      const url = offeringPath(row.slug, row.type);
      return url ? [{ id: row.id, linkType: "offering" as const, label: row.title, url, typeLabel: row.type === "software" ? "Phần mềm" : row.type === "solution" ? "Giải pháp" : "Dịch vụ" }] : [];
    }),
    ...equipmentRows.map((row) => ({ id: row.id, linkType: "equipment" as const, label: row.name, url: `/thiet-bi/${row.slug}`, typeLabel: "Thiết bị" })),
  ];
}

export async function listPublishedNavigationTargets() {
  return readPublishedNavigationTargets();
}

export async function resolvePublishedNavigationItems(items: NavigationItems): Promise<NavigationItems> {
  const ids = items.reduce<TargetIds>((result, item) => {
    if (item.linkType !== "custom" && item.contentId) (result[item.linkType] ??= []).push(item.contentId);
    return result;
  }, {});
  if (Object.values(ids).every((value) => !value?.length)) return items;

  const targets = await readPublishedNavigationTargets(ids);
  const byReference = new Map(targets.map((target) => [`${target.linkType}:${target.id}`, target]));
  const keptKeys = new Set<string>();
  const resolved: NavigationItems = [];
  for (const item of items) {
    const target = item.linkType === "custom" || !item.contentId ? null : byReference.get(`${item.linkType}:${item.contentId}`);
    if ((item.linkType !== "custom" && !target) || (item.parentKey !== null && !keptKeys.has(item.parentKey))) continue;
    resolved.push(target ? { ...item, url: target.url } : item);
    keptKeys.add(item.key);
  }
  return resolved;
}

export async function readNavigation(location: NavigationLocation) {
  const [menu] = await getDb().select().from(menus).where(eq(menus.location, location)).limit(1);
  if (!menu) return null;
  return { menu, items: await selectMenuItems(menu.id) };
}

export async function readNavigationById(id: string) {
  const [menu] = await getDb().select().from(menus).where(eq(menus.id, id)).limit(1);
  if (!menu) return null;
  return { menu, items: await selectMenuItems(menu.id) };
}

type WriteNavigationInput = {
  location: NavigationLocation;
  name: string;
  items: NavigationItems;
  userId: string;
  expectedVersion?: number;
  changeNote: string;
};

export function writeNavigation(input: WriteNavigationInput, database = getDb()): Promise<NavigationDocument> {
  return database.transaction(async (tx) => {
    await tx.insert(menus).values({ name: input.name, location: input.location }).onConflictDoNothing({ target: menus.location });

    const [menu] = await tx.select().from(menus).where(eq(menus.location, input.location)).limit(1).for("update");
    if (!menu) throw new Error("Không tìm thấy menu vừa khởi tạo.");
    if (input.expectedVersion !== undefined && menu.version !== input.expectedVersion) throw new NavigationWriteConflictError();

    const beforeRows = await tx.select().from(menuItems).where(eq(menuItems.menuId, menu.id)).orderBy(asc(menuItems.sortOrder));
    const beforeItems = serializeItems(beforeRows);
    const existingIds = new Set(beforeRows.map((row) => row.id));
    const resolvedIds = new Map<string, string>();

    for (const [index, row] of beforeRows.entries()) {
      await tx.update(menuItems)
        .set({ parentId: null, sortOrder: -1000 - index, updatedAt: new Date() })
        .where(eq(menuItems.id, row.id));
    }

    for (const [index, item] of input.items.entries()) {
      if (existingIds.has(item.key)) {
        resolvedIds.set(item.key, item.key);
        continue;
      }
      const [created] = await tx.insert(menuItems).values({
        menuId: menu.id,
        parentId: null,
        label: item.label,
        url: item.url,
        linkType: item.linkType,
        contentId: item.contentId,
        target: item.target,
        isEnabled: item.isEnabled,
        sortOrder: -index - 1,
      }).returning({ id: menuItems.id });
      resolvedIds.set(item.key, created.id);
    }

    for (const [index, item] of input.items.entries()) {
      const id = resolvedIds.get(item.key);
      if (!id) throw new Error("Không thể xác định mục menu cần lưu.");
      const parentId = item.parentKey ? resolvedIds.get(item.parentKey) : null;
      if (item.parentKey && !parentId) throw new Error("Không thể xác định mục menu cha.");
      await tx.update(menuItems).set({
        parentId,
        label: item.label,
        url: item.url,
        linkType: item.linkType,
        contentId: item.contentId,
        target: item.target,
        isEnabled: item.isEnabled,
        sortOrder: index,
        updatedAt: new Date(),
      }).where(and(eq(menuItems.id, id), eq(menuItems.menuId, menu.id)));
    }

    const retainedIds = new Set(resolvedIds.values());
    const removedIds = beforeRows.filter((row) => !retainedIds.has(row.id)).map((row) => row.id);
    if (removedIds.length > 0) await tx.delete(menuItems).where(inArray(menuItems.id, removedIds));

    const persistedItems: NavigationItems = input.items.map((item) => ({
      ...item,
      key: resolvedIds.get(item.key)!,
      parentKey: item.parentKey ? resolvedIds.get(item.parentKey)! : null,
    }));
    const version = menu.version + 1;
    const [updatedMenu] = await tx.update(menus).set({ name: input.name, version, updatedAt: new Date() })
      .where(and(eq(menus.id, menu.id), eq(menus.version, menu.version))).returning({ id: menus.id });
    if (!updatedMenu) throw new NavigationWriteConflictError();

    await tx.insert(menuRevisions).values({
      menuId: menu.id,
      editorId: input.userId,
      versionNumber: version,
      snapshot: persistedItems,
      changeNote: input.changeNote,
    });
    await tx.insert(auditLogs).values({
      userId: input.userId,
      action: "navigation.update",
      entityType: "menu",
      entityId: menu.id,
      beforeData: beforeItems,
      afterData: persistedItems,
    });

    return { id: menu.id, location: input.location, version, items: persistedItems };
  });
}
