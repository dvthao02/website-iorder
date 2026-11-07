import Link from "next/link";
import type { ComponentProps } from "react";

import { isRewrittenPath } from "@/lib/legacy-paths";

// Link của website. URL tiếng Việt được ánh xạ bằng rewrites() (/tin-tuc → /news…): router của Next 16 không giữ được
// kết quả tải trước của URL bị rewrite (phản hồi báo x-nextjs-rewritten-path khác URL đã xin) nên tải lại liên tục,
// khoảng 10 lần mỗi giây cho mỗi liên kết đang hiện trên màn hình. Các trang đều render động nên tải trước vốn chỉ lấy
// rất ít; tắt tải trước cho các URL này không làm chậm điều hướng mà tránh hàng chục yêu cầu thừa mỗi giây tới server.
export function SiteLink({ prefetch, ...props }: ComponentProps<typeof Link>) {
  const href = typeof props.href === "string" ? props.href : props.href.pathname ?? "";
  return <Link prefetch={prefetch ?? (isRewrittenPath(href) ? false : undefined)} {...props} />;
}
