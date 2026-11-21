// /llms.txt: bản mục lục dạng Markdown cho công cụ AI (ChatGPT, Claude, Perplexity, Gemini…) theo đề xuất llmstxt.org.
// Chỉ liệt kê nội dung đã xuất bản và cho phép lập chỉ mục; AI đọc nhanh website mà không phải cào từng trang.

export type LlmsLink = { title: string; url: string; description?: string | null };
export type LlmsSection = { title: string; links: readonly LlmsLink[] };

const descriptionLimit = 220;

function oneLine(text: string) {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

// Ngoặc vuông trong tiêu đề làm hỏng cú pháp liên kết Markdown.
function linkTitle(text: string) {
  return oneLine(text).replace(/[[\]]/g, "");
}

function shorten(text: string) {
  const line = oneLine(text);
  return line.length <= descriptionLimit ? line : `${line.slice(0, descriptionLimit - 1).trimEnd()}…`;
}

function linkLine(link: LlmsLink) {
  const description = link.description ? shorten(link.description) : "";
  return `- [${linkTitle(link.title)}](${link.url})${description ? `: ${description}` : ""}`;
}

/** Dựng nội dung llms.txt. Mỗi URL chỉ xuất hiện một lần (mục đầu tiên giữ); mục không còn liên kết thì bỏ. */
export function buildLlmsTxt(input: { name: string; summary: string | null; notes?: readonly string[]; sections: readonly LlmsSection[] }) {
  const seen = new Set<string>();
  const lines = [`# ${linkTitle(input.name) || "Website"}`, ""];
  if (input.summary && oneLine(input.summary)) lines.push(`> ${oneLine(input.summary)}`, "");
  for (const note of input.notes ?? []) if (oneLine(note)) lines.push(oneLine(note), "");
  for (const section of input.sections) {
    const links = section.links.filter((link) => {
      if (!link.title.trim() || seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    });
    if (!links.length) continue;
    lines.push(`## ${linkTitle(section.title)}`, "", ...links.map(linkLine), "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
