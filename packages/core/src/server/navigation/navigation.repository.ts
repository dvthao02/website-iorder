import { and, asc, eq, inArray } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { auditLogs, menuItems, menuRevisions, menus } from "@iorder/core/db/schema";

import type { NavigationDocument, NavigationItems, NavigationLocation } from "./navigation.contract";

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
    target: row.target as "_self" | "_blank",
    isEnabled: row.isEnabled,
  }));
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

export function writeNavigation(input: WriteNavigationInput): Promise<NavigationDocument> {
  return getDb().transaction(async (tx) => {
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
