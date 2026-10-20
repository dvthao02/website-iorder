// Nhập file vào trình soạn thảo: .docx (mammoth), .md (bộ chuyển tự viết), .html/.htm.
// Kết quả là HTML đã gom ảnh về Thư viện media; Tiptap đọc HTML này theo schema của nó
// (thẻ lạ bị bỏ), và máy chủ còn kiểm tra lại khi lưu.

export type ImportResult = { html: string; title: string | null; warnings: string[] };
export type UploadImage = (file: File) => Promise<string>;

const supportedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function inlineMarkdown(text: string) {
  return escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt: string, src: string) => `<img alt="${alt}" src="${src}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => `<a href="${href}">${label}</a>`)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a?: string, b?: string) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_([^_\s][^_]*)_/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>");
}

/** Markdown thông dụng → HTML: tiêu đề, đoạn, đậm/nghiêng, liên kết, ảnh, danh sách, trích dẫn, mã, bảng, kẻ ngang. */
export function markdownToHtml(markdown: string) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let index = 0;
  const isTableRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
  const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (/^```/.test(line)) {
      const code: string[] = [];
      index++;
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
      index++;
      out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) { const level = Math.min(heading[1].length, 6); out.push(`<h${level}>${inlineMarkdown(heading[2].replace(/\s+#+\s*$/, ""))}</h${level}>`); index++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); index++; continue; }
    if (isTableRow(line) && index + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[index + 1])) {
      const header = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && isTableRow(lines[index])) rows.push(cells(lines[index++]));
      out.push(`<table><tr>${header.map((cell) => `<th>${inlineMarkdown(cell)}</th>`).join("")}</tr>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell)}</td>`).join("")}</tr>`).join("")}</table>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${markdownToHtml(quote.join("\n"))}</blockquote>`);
      continue;
    }
    const listMatch = line.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (listMatch) {
      const ordered = /\d/.test(listMatch[1]);
      const items: string[] = [];
      while (index < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[index]) && (/\d/.test(lines[index].trim()[0]) === ordered)) {
        items.push(lines[index++].replace(/^\s*([-*+]|\d+[.)])\s+/, "").replace(/^\[[ xX]\]\s+/, ""));
      }
      out.push(`<${ordered ? "ol" : "ul"}>${items.map((item) => `<li><p>${inlineMarkdown(item)}</p></li>`).join("")}</${ordered ? "ol" : "ul"}>`);
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|```|>\s?|\s*([-*+]|\d+[.)])\s+)/.test(lines[index]) && !isTableRow(lines[index])) paragraph.push(lines[index++].trim());
    out.push(`<p>${paragraph.map(inlineMarkdown).join("<br>")}</p>`);
  }
  return out.join("");
}

function dataUrlToFile(dataUrl: string, name: string) {
  const [meta, base64] = dataUrl.split(",");
  const type = meta.match(/data:([^;]+)/)?.[1] ?? "application/octet-stream";
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new File([bytes], `${name}.${type.split("/")[1] ?? "bin"}`, { type });
}

/**
 * Chuẩn hóa HTML trước khi nạp vào trình soạn: bỏ script/style, H1 → H2 (H1 là tiêu đề bài),
 * ảnh nhúng (data:) tải lên Thư viện media, ảnh ngoài thì bỏ và báo lại.
 */
export async function normalizeImportedHtml(html: string, uploadImage: UploadImage): Promise<ImportResult> {
  const warnings: string[] = [];
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script, style, meta, link, iframe, object, embed, form").forEach((element) => element.remove());
  const firstH1 = document.querySelector("h1");
  const title = firstH1?.textContent?.trim() || null;
  firstH1?.remove();
  document.querySelectorAll("h1").forEach((element) => { const heading = document.createElement("h2"); heading.innerHTML = element.innerHTML; element.replaceWith(heading); });
  document.querySelectorAll("h5, h6").forEach((element) => { const heading = document.createElement("h4"); heading.innerHTML = element.innerHTML; element.replaceWith(heading); });

  let uploaded = 0, dropped = 0, unsupported = 0;
  for (const [position, image] of [...document.querySelectorAll("img")].entries()) {
    const src = image.getAttribute("src") ?? "";
    if (src.startsWith("/media/")) continue;
    if (src.startsWith("data:")) {
      const file = dataUrlToFile(src, `anh-nhap-${position + 1}`);
      if (!supportedImageTypes.has(file.type)) { image.remove(); unsupported++; continue; }
      try {
        image.setAttribute("src", await uploadImage(file));
        uploaded++;
      } catch {
        image.remove();
        dropped++;
      }
      continue;
    }
    image.remove();
    dropped++;
  }
  if (uploaded) warnings.push(`Đã tải ${uploaded} ảnh trong file vào Thư viện media.`);
  if (unsupported) warnings.push(`Bỏ ${unsupported} ảnh có định dạng chưa hỗ trợ (chỉ nhận PNG, JPEG, WebP).`);
  if (dropped) warnings.push(`Bỏ ${dropped} ảnh nằm ngoài website hoặc tải lên thất bại; hãy chèn lại bằng nút Ảnh.`);
  return { html: document.body.innerHTML, title, warnings };
}

export const importAccept = ".docx,.md,.markdown,.html,.htm,.txt";

/** Đọc file người dùng chọn thành HTML đã chuẩn hóa. */
export async function importFile(file: File, uploadImage: UploadImage): Promise<ImportResult> {
  const name = file.name.toLowerCase();
  if (file.size > 30 * 1024 * 1024) throw new Error("File quá lớn (tối đa 30 MB).");
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const normalized = await normalizeImportedHtml(result.value, uploadImage);
    const lost = result.messages.filter((message) => message.type === "warning").length;
    return { ...normalized, warnings: [...normalized.warnings, ...(lost ? [`Một số định dạng đặc biệt trong file Word (${lost}) không chuyển được và đã được bỏ qua.`] : [])] };
  }
  const text = await file.text();
  if (name.endsWith(".md") || name.endsWith(".markdown") || name.endsWith(".txt")) return normalizeImportedHtml(markdownToHtml(text), uploadImage);
  if (name.endsWith(".html") || name.endsWith(".htm")) return normalizeImportedHtml(text, uploadImage);
  throw new Error("Chỉ nhập được file Word (.docx), Markdown (.md) hoặc HTML (.html).");
}
