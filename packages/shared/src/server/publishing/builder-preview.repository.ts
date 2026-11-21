import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb } from "@iorder/shared/db/client";
import { builderPreviews } from "@iorder/shared/db/schema";
import { builderPreviewDocumentSchema, builderPreviewTtlMs, type BuilderPreviewRequest } from "./builder-preview.contract";

export async function writeBuilderPreview(ownerId: string, input: BuilderPreviewRequest, database = getDb(), now = new Date()) {
  return database.transaction(async tx => {
    await tx.delete(builderPreviews).where(lt(builderPreviews.expiresAt, now));
    const values = { ownerId, kind: input.document.kind, documentId: input.documentId, sequence: input.sequence, payload: input.document, parentOrigin: input.parentOrigin, expiresAt: new Date(now.getTime() + builderPreviewTtlMs) };
    const [row] = await tx.insert(builderPreviews).values({ id: input.previewId, ...values }).onConflictDoUpdate({
      target: builderPreviews.id,
      set: values,
      setWhere: and(eq(builderPreviews.ownerId, ownerId), lt(builderPreviews.sequence, input.sequence)),
    }).returning({ id: builderPreviews.id, sequence: builderPreviews.sequence });
    // Mỗi tài khoản giữ tối đa 20 phiên đang hoạt động (nhiều tab editor); chỉ dọn bản preview, không đụng nội dung.
    await tx.execute(sql`delete from ${builderPreviews} where ${builderPreviews.ownerId} = ${ownerId} and ${builderPreviews.id} in (select id from ${builderPreviews} where ${builderPreviews.ownerId} = ${ownerId} order by expires_at desc offset 20)`);
    return row;
  });
}

export async function findBuilderPreview(id: string, database = getDb(), now = new Date()) {
  const [row] = await database.select().from(builderPreviews).where(and(eq(builderPreviews.id, id), gt(builderPreviews.expiresAt, now))).limit(1);
  if (!row) return undefined;
  const parsed = builderPreviewDocumentSchema.safeParse(row.payload);
  return parsed.success && parsed.data.kind === row.kind ? { ...row, document: parsed.data } : undefined;
}
