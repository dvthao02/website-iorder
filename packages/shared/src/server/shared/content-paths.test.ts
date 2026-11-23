import assert from "node:assert/strict";
import test from "node:test";

import { claimedContentPath, contentPathChange, movedContentPath, offeringPublicPath, pagePublicPath, postPublicPath } from "./content-paths";

const now = new Date("2026-10-21T10:00:00Z");
const past = new Date("2026-10-20T10:00:00Z");
const future = new Date("2026-10-22T10:00:00Z");

test("Đường dẫn công khai theo loại nội dung", () => {
  assert.equal(postPublicPath("bai-a", "news"), "/news/bai-a");
  assert.equal(postPublicPath("cai-may", "guide"), "/support/guides/cai-may");
  assert.equal(offeringPublicPath("iorder", "software"), "/software/iorder");
  assert.equal(offeringPublicPath("x", "industry"), null);
  assert.equal(pagePublicPath("home"), "/");
  assert.equal(pagePublicPath("gioi-thieu-them"), "/pages/gioi-thieu-them");
});

test("Đổi slug nội dung đang hiển thị → chuyển hướng URL cũ sang URL mới", () => {
  assert.deepEqual(movedContentPath({ status: "published", path: "/news/a" }, { status: "published", path: "/news/b" }, now), { from: "/news/a", to: "/news/b" });
  // Hẹn giờ đã tới giờ được coi như đang hiển thị.
  assert.deepEqual(movedContentPath({ status: "scheduled", scheduledAt: past, path: "/news/a" }, { status: "published", path: "/news/b" }, now), { from: "/news/a", to: "/news/b" });
});

test("Không tạo chuyển hướng khi URL cũ chưa từng công khai, nội dung bị gỡ, hoặc đường dẫn không đổi", () => {
  assert.equal(movedContentPath(undefined, { status: "published", path: "/news/b" }, now), null);
  assert.equal(movedContentPath({ status: "draft", path: "/news/a" }, { status: "published", path: "/news/b" }, now), null);
  assert.equal(movedContentPath({ status: "scheduled", scheduledAt: future, path: "/news/a" }, { status: "published", path: "/news/b" }, now), null);
  assert.equal(movedContentPath({ status: "published", path: "/news/a" }, { status: "draft", path: "/news/b" }, now), null);
  assert.equal(movedContentPath({ status: "published", path: "/news/a" }, { status: "archived", path: "/news/b" }, now), null);
  assert.equal(movedContentPath({ status: "published", path: "/news/a" }, { status: "published", path: "/news/a" }, now), null);
  assert.equal(movedContentPath({ status: "published", path: null }, { status: "published", path: "/x" }, now), null);
});

test("Nội dung xuất bản hoặc hẹn giờ chiếm đường dẫn của nó (gỡ chuyển hướng đang dùng đường dẫn đó)", () => {
  assert.equal(claimedContentPath({ status: "published", path: "/news/a" }), "/news/a");
  assert.equal(claimedContentPath({ status: "scheduled", scheduledAt: future, path: "/news/a" }), "/news/a");
  assert.equal(claimedContentPath({ status: "draft", path: "/news/a" }), null);
  assert.equal(claimedContentPath({ status: "archived", path: "/news/a" }), null);
  assert.equal(claimedContentPath({ status: "published", path: null }), null);
  assert.deepEqual(contentPathChange(undefined, { status: "published", path: "/news/a" }, now), { moved: null, claimed: "/news/a" });
  assert.deepEqual(contentPathChange({ status: "published", path: "/news/a" }, { status: "published", path: "/news/b" }, now), { moved: { from: "/news/a", to: "/news/b" }, claimed: "/news/b" });
});
