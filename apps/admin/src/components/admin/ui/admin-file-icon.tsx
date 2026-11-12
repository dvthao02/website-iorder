import { ArrowDown, ArrowUp, FileArchive, FileCode, FileImage, FileSpreadsheet, FileText, type LucideIcon } from "lucide-react";

// Quy chuẩn loại tệp của CMS: mỗi loại một màu nhận diện cố định qua mọi theme (giống màu ứng dụng gốc,
// người vận hành nhìn là biết), một biểu tượng; "export" thêm mũi tên xuống, "import" mũi tên lên ở góc.
// Màu nằm ở token --cms-file-* (tokens.css); lớp admin-file-tone--<loại> dùng chung cho ô biểu tượng và nút.
export type AdminFileKind = "excel" | "csv" | "word" | "pdf" | "zip" | "image" | "text";

const icons: Record<AdminFileKind, LucideIcon> = {
  excel: FileSpreadsheet, csv: FileSpreadsheet, word: FileText, pdf: FileText, zip: FileArchive, image: FileImage, text: FileCode,
};

export const fileKindLabels: Record<AdminFileKind, string> = {
  excel: "Excel", csv: "CSV", word: "Word", pdf: "PDF", zip: "ZIP", image: "Ảnh", text: "Tệp văn bản",
};

/** Loại tệp từ MIME type hoặc tên tệp (đuôi). Không nhận ra thì là "text". */
export function fileKindOf(value: string | null | undefined): AdminFileKind {
  const source = (value ?? "").toLowerCase();
  if (source.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(source)) return "image";
  if (source === "application/pdf" || source.endsWith(".pdf")) return "pdf";
  if (source.includes("zip") || source.endsWith(".zip")) return "zip";
  if (source.includes("spreadsheetml") || /\.xlsx?$/.test(source)) return "excel";
  if (source === "text/csv" || source.endsWith(".csv")) return "csv";
  if (source.includes("wordprocessingml") || /\.docx?$/.test(source)) return "word";
  return "text";
}

export function AdminFileIcon({ action, className = "", kind, size = "md" }: {
  action?: "export" | "import";
  className?: string;
  kind: AdminFileKind;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = icons[kind];
  const Arrow = action === "export" ? ArrowDown : action === "import" ? ArrowUp : null;
  return <span aria-hidden="true" className={`admin-file-icon admin-file-icon--${size} admin-file-tone--${kind} ${className}`.trim()}>
    <Icon />
    {Arrow ? <span className="admin-file-icon__action"><Arrow /></span> : null}
  </span>;
}
