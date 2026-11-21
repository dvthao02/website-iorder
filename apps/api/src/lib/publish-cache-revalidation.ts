import { revalidatePath as revalidateNextPath } from "next/cache";
import { after } from "next/server";

import { publicContentCacheTag, signPublicCacheInvalidation } from "@iorder/shared/server/publishing/cache-invalidation";
import { logger } from "@iorder/shared/server/shared/logger";
import { submitPublishedUrls } from "./indexnow";

const timeoutMilliseconds = 3_000;
let missingConfigurationReported = false;

/** Trả về true khi website đã làm mới cache (để biết sitemap và trang mới đã hiện, rồi mới báo công cụ tìm kiếm). */
async function notifyPublishWeb() {
  const endpoint = process.env.PUBLISH_WEB_REVALIDATE_URL?.trim();
  const secret = process.env.PUBLISH_WEB_REVALIDATE_SECRET?.trim();
  if (!endpoint || !secret) {
    // Production Compose requires both; locally a missing value means edits only show after the 60 s TTL.
    if (!missingConfigurationReported) logger.warn("Chưa cấu hình PUBLISH_WEB_REVALIDATE_URL/SECRET: website chỉ cập nhật sau 60 giây.");
    missingConfigurationReported = true;
    return false;
  }

  const body = JSON.stringify({ tags: [publicContentCacheTag] });
  const timestamp = String(Date.now());
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMilliseconds);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      body,
      headers: {
        "content-type": "application/json",
        "x-iorder-cache-timestamp": timestamp,
        "x-iorder-cache-signature": signPublicCacheInvalidation(secret, timestamp, body),
      },
      signal: controller.signal,
    });
    if (!response.ok) logger.error("Làm mới cache public thất bại.", { status: response.status, endpoint });
    return response.ok;
  } catch (error) {
    logger.error("Không thể gọi dịch vụ làm mới cache public.", { endpoint, error });
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Every mutation invalidates the same single tag, so one pending notification
// covers all revalidatePath calls made before it starts. The flag is cleared
// before sending, so a mutation committed during an in-flight request still
// schedules its own notification.
let notificationScheduled = false;
// Đường dẫn cụ thể (không phải mẫu [slug]) đã làm mới trong lượt này: sau khi website cập nhật thì báo IndexNow nếu có bật.
const refreshedPaths = new Set<string>();

async function sendScheduledNotification() {
  notificationScheduled = false;
  const paths = [...refreshedPaths];
  refreshedPaths.clear();
  const refreshed = await notifyPublishWeb();
  if (!refreshed || !paths.length) return;
  try { await submitPublishedUrls(paths); } catch (error) { logger.warn("Không báo được IndexNow.", { error }); }
}

export function revalidatePath(path: string, type?: "page" | "layout") {
  revalidateNextPath(path, type);
  if (!type) refreshedPaths.add(path);
  if (notificationScheduled) return;
  notificationScheduled = true;
  try {
    after(sendScheduledNotification);
  } catch (error) {
    notificationScheduled = false;
    throw error;
  }
}
