import { revalidatePath as revalidateNextPath } from "next/cache";
import { after } from "next/server";

import { publicContentCacheTag, signPublicCacheInvalidation } from "@iorder/core/server/publishing/cache-invalidation";
import { logger } from "@iorder/core/server/shared/logger";

const timeoutMilliseconds = 3_000;
let missingConfigurationReported = false;

async function notifyPublishWeb() {
  const endpoint = process.env.PUBLISH_WEB_REVALIDATE_URL?.trim();
  const secret = process.env.PUBLISH_WEB_REVALIDATE_SECRET?.trim();
  if (!endpoint || !secret) {
    // Production Compose requires both; locally a missing value means edits only show after the 60 s TTL.
    if (!missingConfigurationReported) logger.warn("Chưa cấu hình PUBLISH_WEB_REVALIDATE_URL/SECRET: website chỉ cập nhật sau 60 giây.");
    missingConfigurationReported = true;
    return;
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
  } catch (error) {
    logger.error("Không thể gọi dịch vụ làm mới cache public.", { endpoint, error });
  } finally {
    clearTimeout(timeout);
  }
}

// Every mutation invalidates the same single tag, so one pending notification
// covers all revalidatePath calls made before it starts. The flag is cleared
// before sending, so a mutation committed during an in-flight request still
// schedules its own notification.
let notificationScheduled = false;

async function sendScheduledNotification() {
  notificationScheduled = false;
  await notifyPublishWeb();
}

export function revalidatePath(path: string, type?: "page" | "layout") {
  revalidateNextPath(path, type);
  if (notificationScheduled) return;
  notificationScheduled = true;
  try {
    after(sendScheduledNotification);
  } catch (error) {
    notificationScheduled = false;
    throw error;
  }
}
