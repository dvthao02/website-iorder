import { z } from "zod";

const entry = z.object({ eyebrow: z.string().trim().min(1).max(160), title: z.string().trim().min(1).max(220), description: z.string().trim().max(2_000).nullable() }).strict();
export const catalogContentSchema = z.object({ software: entry, solution: entry, service: entry, industry: entry }).strict();
export type CatalogContent = z.infer<typeof catalogContentSchema>;
