import {
  collectMediaUsage,
  listQueuedMediaForCleanup,
  permanentlyDeleteQueuedMediaAsset,
} from "@iorder/core/server/media/media.repository";
import { removeStoredObject } from "@iorder/core/server/media/storage";

const retentionDays = 7;
async function main() {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const queued = await listQueuedMediaForCleanup(cutoff);
  let removed = 0;
  let retained = 0;

  for (const asset of queued) {
    const usage = await collectMediaUsage(asset.id);
    if (usage.length) {
      retained += 1;
      console.warn(`Giữ lại media ${asset.id}: phát hiện ${usage.length} liên kết đang dùng.`);
      continue;
    }

    try {
      await removeStoredObject(asset.storageKey);
      if (await permanentlyDeleteQueuedMediaAsset(asset.id)) removed += 1;
    } catch {
      console.error(`Chưa thể dọn media ${asset.id}; sẽ thử lại ở lần sau.`);
    }
  }

  console.log(`Đã dọn ${removed} media; giữ lại ${retained} media còn được tham chiếu.`);
}

void main().catch(() => {
  console.error("Không thể hoàn tất dọn media đã xóa.");
  process.exitCode = 1;
});
