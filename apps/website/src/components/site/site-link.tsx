import Link from "next/link";
import React, { type ComponentProps } from "react";

// Link của website. Trước đây thành phần này tắt tải trước cho URL tiếng Việt vì chúng bị rewrite() sang thư mục route tiếng Anh:
// router của Next 16 không giữ được kết quả tải trước của URL bị rewrite (phản hồi báo x-nextjs-rewritten-path khác URL đã xin)
// nên tải lại liên tục. URL public giờ là tiếng Anh, trùng tên thư mục route, không còn rewrite nên Link chạy bình thường.
// Giữ thành phần làm điểm chung để đổi hành vi Link của website ở một chỗ.
export function SiteLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} />;
}
