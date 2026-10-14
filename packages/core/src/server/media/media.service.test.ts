import assert from "node:assert/strict";
import test from "node:test";

import { createMediaDeletionService, MediaInUseError } from "./media.service";

const mediaId = "11111111-1111-4111-8111-111111111111";
const editorId = "22222222-2222-4222-8222-222222222222";

function createRepository(options: { exists?: boolean; usage?: number } = {}) {
  let queued = 0;
  const repository = {
    async findMediaAsset() { return options.exists === false ? undefined : { id: mediaId }; },
    async collectMediaUsage() { return Array.from({ length: options.usage ?? 0 }, (_, index) => ({ entityId: String(index) })); },
    async queueMediaAssetDeletion() { queued += 1; return { id: mediaId }; },
  } as unknown as Parameters<typeof createMediaDeletionService>[0];
  return { queued: () => queued, repository };
}

test("chỉ đưa media không được dùng vào hàng đợi dọn dẹp", async () => {
  const fake = createRepository();
  const service = createMediaDeletionService(fake.repository);

  assert.equal(await service.deleteAdminMedia(mediaId, editorId), mediaId);
  assert.equal(fake.queued(), 1);
});

test("không queue media đang được tham chiếu", async () => {
  const fake = createRepository({ usage: 1 });
  const service = createMediaDeletionService(fake.repository);

  await assert.rejects(service.deleteAdminMedia(mediaId, editorId), MediaInUseError);
  assert.equal(fake.queued(), 0);
});

test("không queue mã không hợp lệ hoặc media đã không còn hoạt động", async () => {
  const missing = createRepository({ exists: false });
  const service = createMediaDeletionService(missing.repository);

  assert.equal(await service.deleteAdminMedia("not-a-uuid", editorId), undefined);
  assert.equal(await service.deleteAdminMedia(mediaId, editorId), undefined);
  assert.equal(missing.queued(), 0);
});
