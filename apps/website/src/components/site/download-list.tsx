import React from "react";
import { AppWindow, Apple, Download, ExternalLink, FileArchive, FileText, FolderDown, HardDriveDownload, Laptop, Smartphone, Terminal, type LucideIcon } from "lucide-react";

// Đường dẫn tương đối (không dùng alias @/) để bộ chạy test import được component này.
import { downloadHost, downloadKind, groupDownloads, groupIcon, type DownloadIcon, type GroupIcon } from "../../lib/downloads";
import { createTranslate, type Translate } from "../../lib/translate";
import { DownloadButton } from "../ui/download-button";

export type DownloadListItem = { id: string; title: string; description: string | null; meta: string | null; groupName: string | null; downloadUrl: string; external: boolean };

const fileIcons: Record<DownloadIcon, LucideIcon> = { archive: FileArchive, document: FileText, windows: AppWindow, mac: Laptop, mobile: Smartphone, file: HardDriveDownload };
const groupIcons: Record<GroupIcon, LucideIcon> = { windows: AppWindow, apple: Apple, android: Smartphone, linux: Terminal, folder: FolderDown };
const chip = "inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 text-caption font-semibold text-brand-700";
const typeChip = "inline-flex items-center rounded-full border border-line px-2 py-0.5 text-caption font-semibold text-muted";

// Một tệp = một ô gọn: biểu tượng theo loại tệp, tên (kèm thông tin phụ, loại tệp), mô tả hoặc nguồn tải, nút tải bên phải.
// Điện thoại: nút chỉ còn biểu tượng vuông 44px (nhãn "Tải xuống" vẫn có cho trình đọc màn hình) nằm cùng hàng để ô vẫn gọn.
function DownloadRow({ item, t }: { item: DownloadListItem; t: Translate }) {
  const kind = downloadKind(item.downloadUrl);
  const host = item.external ? downloadHost(item.downloadUrl) : null;
  const subline = item.description ?? (host ? t("download.from", { host }) : null);
  const Icon = fileIcons[kind.icon];
  // Nhãn loại tệp (ZIP, PDF…) bỏ đi khi thông tin phụ đã nêu loại tệp (ví dụ "EXE · 80 MB").
  const typeLabel = kind.label && !item.meta?.toUpperCase().includes(kind.label) ? kind.label : null;
  return <li className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-white px-4 py-3.5 transition hover:bg-surface-tinted sm:px-5" data-testid="download-row">
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-control bg-brand-50 text-brand-600"><Icon size={20} strokeWidth={1.8} /></span>
    <span className="min-w-0 flex-1 basis-48">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-semibold text-ink">{item.title}</span>
        {item.meta ? <span className={chip}>{item.meta}</span> : null}
        {typeLabel ? <span className={typeChip}>{typeLabel}</span> : null}
      </span>
      {subline ? <span className="mt-0.5 line-clamp-2 text-small text-muted">{subline}</span> : null}
    </span>
    <DownloadButton className="button button--secondary button--sm button--sm-icon shrink-0" external={item.external} href={item.downloadUrl}>
      {item.external ? <ExternalLink aria-hidden="true" size={16} /> : <Download aria-hidden="true" size={16} />}<span className="max-sm:sr-only">{t("download.button")}</span>
    </DownloadButton>
  </li>;
}

/**
 * Danh sách tệp cài đặt dạng gọn. `grouped`: chia theo "Nhóm" đặt trong CMS (xem groupDownloads), mỗi nhóm một thẻ có tiêu đề
 * (biểu tượng đoán từ tên nhóm: Windows, macOS, Android…) kèm số tệp; không tệp nào có nhóm thì chỉ một thẻ không tiêu đề.
 * `columns`: 2 = các tệp xếp hai cột từ 1024px (tệp lẻ cuối dòng trải hết hàng), 1 = một cột (chỗ hẹp như trang Hỗ trợ).
 * `Heading`: cấp tiêu đề của nhóm, theo cấp của khối chứa danh sách.
 */
export function DownloadList({ items, Heading = "h3", grouped = true, columns = 2, t = createTranslate() }: { items: readonly DownloadListItem[]; Heading?: "h2" | "h3"; grouped?: boolean; columns?: 1 | 2; t?: Translate }) {
  const groups = grouped ? groupDownloads(items) : [{ label: null, items: [...items] }];
  // Đường kẻ mảnh giữa các ô bằng gap-px trên nền màu đường kẻ; ô lẻ cuối cùng trải hết hàng để không để lại ô trống tối màu.
  const grid = columns === 2 ? "lg:grid-cols-2 lg:[&>li:last-child:nth-child(odd)]:col-span-2" : "";
  return <div aria-label={t("download.listLabel")} className="grid gap-6">
    {groups.map(group => {
      const GroupIcon = group.label ? groupIcons[groupIcon(group.label)] : null;
      return <section className="overflow-hidden rounded-card border border-line bg-white shadow-card" key={group.label ?? "tat-ca"}>
        {group.label && GroupIcon ? <Heading className="m-0 flex items-center gap-2.5 border-b border-line bg-surface-tinted px-4 py-3 text-body font-bold text-ink sm:px-5">
          <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-control bg-white text-brand-600 shadow-card"><GroupIcon size={18} strokeWidth={1.8} /></span>
          {group.label}
          <span className="text-small font-medium text-faint">({group.items.length})</span>
        </Heading> : null}
        <ul className={`m-0 grid list-none gap-px bg-line p-0 ${grid}`.trim()}>
          {group.items.map(item => <DownloadRow item={item} key={item.id} t={t} />)}
        </ul>
      </section>;
    })}
  </div>;
}
