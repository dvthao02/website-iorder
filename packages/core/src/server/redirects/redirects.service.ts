import { redirectInputSchema } from "./redirects.contract";
import { deleteRedirect, findEnabledRedirect, listRedirects, saveRedirect } from "./redirects.repository";
import { z } from "zod";

export async function getRedirects() {
  return (await listRedirects()).map((row) => {
    const { id, sourcePath, destinationPath, statusCode, isEnabled } = row;

    return {
      id,
      ...redirectInputSchema.parse({ sourcePath, destinationPath, statusCode, isEnabled }),
    };
  });
}
export async function getEnabledRedirect(sourcePath: string) { return findEnabledRedirect(sourcePath); }
export async function writeRedirect(id: string | null, input: unknown, userId: string) { return saveRedirect(id, redirectInputSchema.parse(input), userId); }
export async function deleteAdminRedirect(id: string, userId: string) { return z.string().uuid().safeParse(id).success ? deleteRedirect(id, userId) : undefined; }
