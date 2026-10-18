import { NextResponse } from "next/server";

import { hasAnyCmsPermission, hasCmsPermission, type CmsActor, type CmsPermissionCode } from "@iorder/core/server/auth/permissions";

const liveStatuses = new Set(["published", "scheduled"]);

// Content that is (or would become) visible on the website may only be
// changed by someone holding `<module>.publish`. Archive/restore always counts.
// Optimistic versioning makes the read-then-write safe: if the item's status
// changes in between, its version changes too and the write returns 409.
export function needsPublishPermission(change: { stateAction?: string | null; requestedStatus?: unknown; currentStatus?: string | null }) {
  return Boolean(change.stateAction)
    || (typeof change.requestedStatus === "string" && liveStatuses.has(change.requestedStatus))
    || (typeof change.currentStatus === "string" && liveStatuses.has(change.currentStatus));
}

export function requestedStatusOf(values: unknown) {
  return values && typeof values === "object" && "status" in values ? (values as { status?: unknown }).status : undefined;
}

export function forbiddenResponse(message = "Bạn không có quyền thực hiện thao tác này.") {
  return NextResponse.json({ error: { code: "FORBIDDEN", message } }, { status: 403 });
}

// Returns a 403 response when the actor lacks the permission (or all of the
// listed alternatives), otherwise null.
export function denyUnless(actor: CmsActor, permission: CmsPermissionCode | readonly CmsPermissionCode[], message?: string) {
  const allowed = typeof permission === "string" ? hasCmsPermission(actor, permission) : hasAnyCmsPermission(actor, permission);
  return allowed ? null : forbiddenResponse(message);
}

export function denyPublishUnless(actor: CmsActor, permission: CmsPermissionCode | readonly CmsPermissionCode[], change: Parameters<typeof needsPublishPermission>[0]) {
  return needsPublishPermission(change)
    ? denyUnless(actor, permission, "Bạn không có quyền xuất bản hoặc sửa nội dung đang hiển thị trên website.")
    : null;
}
