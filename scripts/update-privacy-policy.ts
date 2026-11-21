import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/shared/src/db/client";
import { users } from "../packages/shared/src/db/schema";
import { privacyPolicyChangeNote, privacyPolicyDocument, privacyPolicyFootnote, privacyPolicySeoDescription } from "../packages/shared/src/server/pages/privacy-policy-content";
import { getAdminPageBySlug, saveAdminPage } from "../packages/shared/src/server/pages/pages.service";
import { sanitizeRichDocument } from "../packages/shared/src/server/shared/rich-text";

// Cập nhật trang "Chính sách bảo mật" (slug privacy-policy, /chinh-sach-bao-mat) theo bản công bố tại https://app.iorder.vn/privacy-policy.
// Nội dung ở packages/shared/src/server/pages/privacy-policy-content.ts. Chỉ đổi: nội dung khối "Văn bản" (thêm khối nếu trang chưa có),
// dòng "Cập nhật" ở phần đầu trang và mô tả SEO; giữ nguyên tiêu đề, giao diện và mọi thiết lập khác của trang.
// Lưu qua CMS nên có phiên bản mới kèm lịch sử (bản cũ khôi phục được). Chạy lại nhiều lần an toàn: đã đúng bản này thì không lưu lại.
//   pnpm db:update:privacy-policy              ghi vào CMS
//   pnpm db:update:privacy-policy --dry-run    chỉ cho biết sẽ đổi gì
// Website lưu nội dung công khai tối đa vài chục giây nên trang công khai cập nhật chậm một chút.
const dryRun = process.argv.includes("--dry-run");

async function run() {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const [administrator] = username ? await getDb().select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1) : [];
  if (!administrator && !dryRun) throw new Error("Không tìm thấy tài khoản quản trị (INITIAL_ADMIN_USERNAME) để lưu trang.");

  const page = await getAdminPageBySlug("privacy-policy");
  if (!page) throw new Error("Chưa có trang chính sách bảo mật (chạy pnpm db:seed:v1-static-pages trước).");

  const body = sanitizeRichDocument(privacyPolicyDocument);
  const newBody = JSON.stringify(body);
  let heroSeen = false;
  let bodySeen = false;
  let previousFootnote: string | null = null;
  let previousBodyChanged = false;
  const blocks = page.blocks.map((block) => {
    if (block.type === "hero" && !heroSeen) {
      heroSeen = true;
      previousFootnote = block.data.footnote;
      return { ...block, data: { ...block.data, footnote: privacyPolicyFootnote } };
    }
    if (block.type === "rich_text" && !bodySeen) {
      bodySeen = true;
      previousBodyChanged = JSON.stringify(block.data.body) !== newBody;
      return { ...block, data: { ...block.data, body } };
    }
    return block;
  });
  if (!bodySeen) blocks.push({ type: "rich_text", isEnabled: true, data: { heading: null, body } });

  const footnoteChanged = heroSeen && previousFootnote !== privacyPolicyFootnote;
  const seoChanged = page.seoDescription !== privacyPolicySeoDescription;
  if (!previousBodyChanged && bodySeen && !footnoteChanged && !seoChanged) { console.log("Trang chính sách bảo mật đã là bản mới nhất, giữ nguyên."); return; }

  const changes = [bodySeen ? (previousBodyChanged ? "nội dung" : "") : "thêm khối nội dung", footnoteChanged ? `dòng cập nhật ("${previousFootnote ?? ""}" → "${privacyPolicyFootnote}")` : "", seoChanged ? "mô tả SEO" : ""].filter(Boolean).join(", ");
  if (dryRun) { console.log(`Chạy thử: sẽ đổi ${changes}. Chưa ghi gì vào CMS.`); return; }
  await saveAdminPage(page.id, {
    title: page.title, slug: page.slug, template: page.template, status: page.status, seoTitle: page.seoTitle, seoDescription: privacyPolicySeoDescription,
    canonicalUrl: page.canonicalUrl, seo: page.seo, scheduledAt: page.scheduledAt, blocks,
  }, administrator!.id, { expectedVersion: page.draftVersion, changeNote: privacyPolicyChangeNote });
  console.log(`Đã cập nhật trang chính sách bảo mật: ${changes}.`);
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể cập nhật trang chính sách bảo mật.");
  process.exit(1);
});
