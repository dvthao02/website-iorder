// Video YouTube nhúng trong trang và bài viết. Người vận hành dán link như khi chia sẻ (youtube.com/watch?v=…,
// youtu.be/…, /shorts/…, /live/…, /embed/…); hệ thống chỉ giữ mã video 11 ký tự, website tự dựng khung nhúng.
// Khung nhúng dùng youtube-nocookie.com (chế độ bảo mật nâng cao: YouTube không đặt cookie theo dõi cho tới khi người xem bấm phát).

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const youtubeHosts = new Set(["youtube.com", "youtube-nocookie.com"]);

export function isYoutubeVideoId(value: unknown): value is string {
  return typeof value === "string" && videoIdPattern.test(value);
}

/** Link YouTube → mã video; link khác (hoặc không đọc được) → null. */
export function youtubeVideoId(input: string): string | null {
  const value = input.trim();
  if (!value || value.length > 500) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^(?:www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (youtubeHosts.has(host)) {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : /^\/(?:embed|shorts|live|v)\/([^/]+)/.exec(url.pathname)?.[1] ?? null;
  }
  return isYoutubeVideoId(id) ? id : null;
}

/**
 * Một dòng chỉ gồm link YouTube → mã video (để tự đổi thành khối video khi nhập file Word/Markdown hoặc khi dán).
 * Nhận khi: cả dòng là một link YouTube; hoặc cả dòng là đúng một liên kết (chữ bất kỳ) trỏ tới YouTube.
 * Dòng có chữ khác ngoài link thì giữ nguyên là đoạn văn.
 */
export function youtubeLineVideoId(text: string, links: ReadonlyArray<{ href: string; text: string }> = []): string | null {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return null;
  if (!/\s/.test(line)) {
    const direct = youtubeVideoId(line);
    if (direct) return direct;
  }
  if (links.length === 1 && links[0].text.replace(/\s+/g, " ").trim() === line) return youtubeVideoId(links[0].href);
  return null;
}

export const youtubeEmbedUrl = (videoId: string) => `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
export const youtubeWatchUrl = (videoId: string) => `https://www.youtube.com/watch?v=${videoId}`;
export const youtubeThumbnailUrl = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
