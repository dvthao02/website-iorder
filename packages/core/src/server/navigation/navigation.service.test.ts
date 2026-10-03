import assert from "node:assert/strict";
import test from "node:test";

import type { NavigationDocument, NavigationItems, NavigationLocation } from "./navigation.contract";
import { NavigationWriteConflictError } from "./navigation.repository";
import { createNavigationService, NavigationVersionConflictError } from "./navigation.service";
import { safeLinkSchema } from "@iorder/core/server/shared/url.contract";

const menuId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

function createRepository(initial: NavigationDocument | null = null) {
  let current = initial;
  let lastWrite: {
    location: NavigationLocation;
    items: NavigationItems;
    expectedVersion?: number;
    changeNote: string;
  } | null = null;

  function record(document: NavigationDocument) {
    const now = new Date("2026-10-02T00:00:00.000Z");
    return {
      menu: { id: document.id!, name: "Menu", location: document.location, version: document.version, createdAt: now, updatedAt: now },
      items: document.items.map((item, index) => ({
        id: item.key,
        menuId: document.id!,
        parentId: item.parentKey,
        label: item.label,
        url: item.url,
        target: item.target,
        icon: null,
        sortOrder: index,
        isEnabled: item.isEnabled,
        createdAt: now,
        updatedAt: now,
      })),
    };
  }

  const repository: Parameters<typeof createNavigationService>[0] = {
    async readNavigation(location) {
      return current?.id && current.location === location ? record(current) : null;
    },
    async readNavigationById(id) {
      return current?.id === id ? record(current) : null;
    },
    async writeNavigation(input) {
      if (current && input.expectedVersion !== undefined && input.expectedVersion !== current.version) throw new NavigationWriteConflictError();
      lastWrite = input;
      current = {
        id: current?.id ?? menuId,
        location: input.location,
        version: (current?.version ?? 0) + 1,
        items: input.items.map((item) => ({ ...item, key: item.key.startsWith("menu-") ? itemId : item.key })),
      };
      return current;
    },
  };

  return { repository, getCurrent: () => current, getLastWrite: () => lastWrite };
}

test("trả tài liệu rỗng cho vị trí chưa có menu", async () => {
  const fake = createRepository();
  const service = createNavigationService(fake.repository);

  assert.deepEqual(await service.getAdminNavigation("footer"), { id: null, location: "footer", version: 0, items: [] });
  assert.equal(await service.getNavigation("footer"), null);
});

test("validate URL trước khi gọi repository", async () => {
  const fake = createRepository();
  const service = createNavigationService(fake.repository);

  await assert.rejects(
    service.saveNavigation("header", [{ key: "new", parentKey: null, label: "Không an toàn", url: "javascript:alert(1)", target: "_self", isEnabled: true }], userId),
  );
  assert.equal(fake.getLastWrite(), null);
});

test("chỉ nhận đường dẫn nội bộ và protocol công khai đã cho phép", () => {
  for (const value of ["/lien-he", "https://iorder.com.vn", "http://localhost:3000", "mailto:support@iorder.com.vn", "tel:+842812345678"]) {
    assert.equal(safeLinkSchema.safeParse(value).success, true, value);
  }
  for (const value of ["//evil.example", "javascript:alert(1)", "data:text/html,unsafe", "/duong dan", "\\\\server\\share"]) {
    assert.equal(safeLinkSchema.safeParse(value).success, false, value);
  }
});

test("không nhận mục con đứng trước hoặc trỏ tới mục cha không tồn tại", async () => {
  const fake = createRepository();
  const service = createNavigationService(fake.repository);

  await assert.rejects(service.saveNavigation("header", [
    { key: "child", parentKey: "parent", label: "Con", url: "/con", target: "_self", isEnabled: true },
    { key: "parent", parentKey: null, label: "Cha", url: "/cha", target: "_self", isEnabled: true },
  ], userId));
  assert.equal(fake.getLastWrite(), null);
});

test("lưu version, ghi chú và nhận lại ID ổn định từ repository", async () => {
  const fake = createRepository();
  const service = createNavigationService(fake.repository);
  const result = await service.saveNavigation("header", [{ key: "menu-new", parentKey: null, label: "Liên hệ", url: "/lien-he", target: "_self", isEnabled: true }], userId, { expectedVersion: 0, changeNote: "  Cập nhật liên hệ  " });

  assert.equal(result.items[0].key, itemId);
  assert.equal(result.version, 1);
  assert.equal(fake.getLastWrite()?.changeNote, "Cập nhật liên hệ");
  assert.equal(fake.getLastWrite()?.expectedVersion, 0);
});

test("chuyển xung đột version thành lỗi nghiệp vụ tiếng Việt", async () => {
  const fake = createRepository({
    id: menuId,
    location: "header",
    version: 2,
    items: [{ key: itemId, parentKey: null, label: "Trang chủ", url: "/", target: "_self", isEnabled: true }],
  });
  const service = createNavigationService(fake.repository);

  await assert.rejects(
    service.saveNavigation("header", fake.getCurrent()!.items, userId, { expectedVersion: 1 }),
    NavigationVersionConflictError,
  );
});
