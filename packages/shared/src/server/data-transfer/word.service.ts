import { and, inArray, isNull } from "drizzle-orm";

import { getDb } from "@iorder/shared/db/client";
import { mediaAssets } from "@iorder/shared/db/schema";
import { getStoredObject } from "../media/storage";
import { postContentToRichDocument, type AdminPost } from "../posts/posts.contract";
import { getAdminPostById, getAdminPosts } from "../posts/posts.service";
import { zipFiles } from "../shared/xlsx";
import { buildDocx, richImageSources, type DocxImage } from "./docx";

// Ảnh nhúng vào Word: tối đa 40 MB cho một lần xuất (cả gói .zip) để không đọc quá nhiều vào RAM.
const maxImageBytes = 40 * 1024 * 1024;
const wordExtensions: Record<string, DocxImage["extension"]> = { "image/png": "png", "image/jpeg": "jpeg", "image/gif": "gif" };

const storageKeyOf = (src: string) => src.startsWith("/media/") ? src.slice("/media/".length).split("/").map(decodeURIComponent).join("/") : null;

async function loadImages(sources: string[], budget: { left: number }) {
  const images = new Map<string, DocxImage>();
  const keys = new Map(sources.flatMap((src) => { const key = storageKeyOf(src); return key ? [[key, src] as const] : []; }));
  if (!keys.size) return images;
  const assets = await getDb().select({ storageKey: mediaAssets.storageKey, mimeType: mediaAssets.mimeType, width: mediaAssets.width, height: mediaAssets.height, fileSize: mediaAssets.fileSize })
    .from(mediaAssets).where(and(inArray(mediaAssets.storageKey, [...keys.keys()]), isNull(mediaAssets.deletedAt)));
  for (const asset of assets) {
    const extension = wordExtensions[asset.mimeType];
    if (!extension || asset.fileSize > budget.left) continue;
    try {
      const object = await getStoredObject(asset.storageKey);
      const data = Buffer.from(await object.Body!.transformToByteArray());
      budget.left -= data.length;
      images.set(keys.get(asset.storageKey)!, { data, extension, width: asset.width, height: asset.height });
    } catch {
      // Ảnh không đọc được (mất object): Word ghi dòng chữ kèm đường dẫn thay vì làm hỏng cả file.
    }
  }
  return images;
}

async function postDocx(post: AdminPost, budget: { left: number }) {
  const doc = postContentToRichDocument(post.content);
  return buildDocx({ title: post.title, summary: post.excerpt, doc, images: await loadImages(richImageSources(doc), budget) });
}

export async function exportPostWord(id: string) {
  const post = await getAdminPostById(id);
  if (!post) return undefined;
  return { body: await postDocx(post, { left: maxImageBytes }), fileName: `${post.slug}.docx`, type: post.type };
}

/** Gói .zip mỗi bài một file .docx (tên theo đường dẫn), cho Bài viết hoặc Hướng dẫn. */
export async function exportPostsWord(kind: "posts" | "guides") {
  const posts = (await getAdminPosts()).filter((post) => (post.type === "guide") === (kind === "guides"));
  const budget = { left: maxImageBytes };
  const files: [string, Buffer][] = [];
  for (const post of posts) files.push([`${post.slug}.docx`, await postDocx(post, budget)]);
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
  return { body: zipFiles(files), fileName: `${kind === "guides" ? "huong-dan" : "bai-viet"}-word-${day}.zip`, count: posts.length };
}
