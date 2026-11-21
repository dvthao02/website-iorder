import { z } from "zod";

export const administratorLoginSchema = z
  .object({
    username: z.string().trim().min(1).max(80),
    password: z.string().min(1).max(1_024),
  })
  .strict();

export type AdministratorLoginInput = z.infer<typeof administratorLoginSchema>;
