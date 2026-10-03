import { z } from "zod";

const internalPath = z.string().trim().min(1).max(1_000).refine((value) => value.startsWith("/") && !value.startsWith("//"), "Đường dẫn phải bắt đầu bằng một dấu gạch chéo.");

export const redirectInputSchema = z.object({
  sourcePath: internalPath.max(500),
  destinationPath: internalPath,
  statusCode: z.union([z.literal(301), z.literal(308)]),
  isEnabled: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.sourcePath === value.destinationPath) context.addIssue({ code: "custom", path: ["destinationPath"], message: "Đích chuyển hướng phải khác đường dẫn nguồn." });
});

export const redirectRequestSchema = z.object({ id: z.string().uuid().nullable(), values: redirectInputSchema }).strict();
export type RedirectInput = z.infer<typeof redirectInputSchema>;
