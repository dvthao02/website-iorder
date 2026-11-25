import { Phone } from "lucide-react";
import type { ReactNode } from "react";
import type { BlockFrame } from "@iorder/shared/server/pages/block-layout";
import { ButtonLink, FrameSection } from "@/components/ui";
import { getT } from "@/lib/messages";

// Dải tư vấn cuối trang chi tiết (sản phẩm, giải pháp, dịch vụ, thiết bị): người đọc hết trang có lối đi tiếp ngay —
// sang trang Liên hệ hoặc gọi hotline (lấy từ Cài đặt › Thông tin website). Mặc định nền tối, một điểm nhấn duy nhất cuối trang;
// `frame` (Bố cục khối trong CMS) đổi nền, khoảng cách, ảnh nền và chữ đổi theo nền sáng/tối.
const defaultFrame: BlockFrame = { tone: "dark", spacing: "sm", anchor: null };
export async function ConsultBand({ title, description, hotline, actionLabel, actionNode, frame = defaultFrame }: { title: string; description: string; hotline: string | null; actionLabel?: string; /** Thay nút chính (sang trang Liên hệ) bằng thành phần riêng, ví dụ nút mở biểu mẫu hỏi mua thiết bị. */ actionNode?: ReactNode; frame?: BlockFrame }) {
  const t = await getT();
  const dark = frame.tone === "dark";
  return <FrameSection frame={frame} glow>
    <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
      <div className="max-w-2xl">
        <h2 className={`mb-0 text-h2 font-bold tracking-tight text-balance ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
        <p className={`mt-3 mb-0 text-lead ${dark ? "text-white/75" : "text-muted"}`}>{description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {actionNode ?? <ButtonLink action={{ label: actionLabel ?? t("consult.freeAdvice"), href: "/contact" }} variant={dark ? "light" : "primary"} />}
        {hotline ? <a className={`button ${dark ? "button--outline-light" : "button--secondary"}`} href={`tel:${hotline.replace(/[^\d+]/g, "")}`}><Phone aria-hidden="true" size={18} />{hotline}</a> : null}
      </div>
    </div>
  </FrameSection>;
}
