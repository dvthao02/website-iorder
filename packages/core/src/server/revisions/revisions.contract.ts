import { z } from "zod";

export const revisionTargetSchema = z.enum(["posts", "offerings", "pages", "equipment", "navigation", "downloads"]);
export const restoreRevisionSchema = z.object({ revisionId: z.string().uuid() }).strict();
export type RevisionTarget = z.infer<typeof revisionTargetSchema>;
