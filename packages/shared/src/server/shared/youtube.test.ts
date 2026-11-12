import assert from "node:assert/strict";
import test from "node:test";

import { isYoutubeVideoId, youtubeEmbedUrl, youtubeLineVideoId, youtubeVideoId } from "./youtube";

test("Đọc mã video từ các dạng link YouTube thường gặp", () => {
  const id = "dQw4w9WgXcQ";
  for (const link of [
    `https://www.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/watch?v=${id}&t=42s&list=PL123`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=abc`,
    `youtu.be/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}?feature=share`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
  ]) assert.equal(youtubeVideoId(link), id, link);
});

test("Link không phải YouTube hoặc mã sai bị từ chối", () => {
  for (const link of ["", "https://vimeo.com/123456", "https://www.youtube.com/watch?v=ngắn", "https://evil.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/@iorder", "không phải link"]) {
    assert.equal(youtubeVideoId(link), null, link);
  }
  assert.equal(isYoutubeVideoId("dQw4w9WgXcQ"), true);
  assert.equal(isYoutubeVideoId("<script>alert"), false);
  assert.equal(youtubeEmbedUrl("dQw4w9WgXcQ"), "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
});

test("Dòng chỉ có link YouTube thành video; dòng có chữ khác hoặc link không phải YouTube thì giữ nguyên", () => {
  const id = "dQw4w9WgXcQ";
  assert.equal(youtubeLineVideoId(`https://youtu.be/${id}`), id);
  assert.equal(youtubeLineVideoId(`  www.youtube.com/watch?v=${id}  `), id);
  // Cả dòng là một liên kết tới YouTube (chữ bất kỳ, như link trong file Word).
  assert.equal(youtubeLineVideoId("Xem video hướng dẫn", [{ href: `https://www.youtube.com/watch?v=${id}`, text: "Xem video hướng dẫn" }]), id);
  // Có chữ khác ngoài link: giữ là đoạn văn.
  assert.equal(youtubeLineVideoId(`Xem tại https://youtu.be/${id}`), null);
  assert.equal(youtubeLineVideoId("Bấm vào đây để xem video", [{ href: `https://youtu.be/${id}`, text: "đây" }]), null);
  // Không phải YouTube, chữ thường, dòng trống.
  assert.equal(youtubeLineVideoId("https://vimeo.com/123456"), null);
  assert.equal(youtubeLineVideoId(id), null);
  assert.equal(youtubeLineVideoId("Bán hàng"), null);
  assert.equal(youtubeLineVideoId("   "), null);
});
