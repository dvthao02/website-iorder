import { Phone } from "lucide-react";
import { ButtonLink, Section } from "@/components/ui";

// Dải tư vấn cuối trang chi tiết (sản phẩm, giải pháp, dịch vụ, thiết bị): người đọc hết trang có lối đi tiếp ngay —
// sang trang Liên hệ hoặc gọi hotline (lấy từ Cài đặt › Thông tin website). Nền tối, một điểm nhấn duy nhất cuối trang.
export function ConsultBand({ title, description, hotline, actionLabel = "Nhận tư vấn miễn phí" }: { title: string; description: string; hotline: string | null; actionLabel?: string }) {
  return <Section space="sm" tone="dark">
    <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
      <div className="max-w-2xl">
        <h2 className="mb-0 text-h2 font-bold tracking-tight text-balance text-white">{title}</h2>
        <p className="mt-3 mb-0 text-lead text-white/75">{description}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink action={{ label: actionLabel, href: "/lien-he" }} variant="light" />
        {hotline ? <a className="button button--outline-light" href={`tel:${hotline.replace(/[^\d+]/g, "")}`}><Phone aria-hidden="true" size={18} />{hotline}</a> : null}
      </div>
    </div>
  </Section>;
}
