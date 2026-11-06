import { youtubeEmbedUrl } from "@iorder/core/server/shared/youtube";

// Khung video YouTube 16:9 dùng chung cho khối "Video YouTube" và video trong bài viết.
// youtube-nocookie.com: không đặt cookie theo dõi cho tới khi người xem bấm phát; tải trễ khi cuộn tới.
// Giữ referrer mặc định (strict-origin-when-cross-origin) vì YouTube từ chối phát khi thiếu nguồn nhúng.
export function YouTubeFrame({ videoId, title, className = "" }: { videoId: string; title: string; className?: string }) {
  return <div className={`relative aspect-video overflow-hidden bg-navy ${className}`.trim()}>
    <iframe
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      className="absolute inset-0 size-full border-0"
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      src={youtubeEmbedUrl(videoId)}
      title={title}
    />
  </div>;
}
