import assert from "node:assert/strict";
import test from "node:test";

import { isYoutubeVideoId, youtubeEmbedUrl, youtubeVideoId } from "./youtube";

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
