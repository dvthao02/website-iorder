import { redirectInputSchema } from "./redirects.contract";
import { deleteRedirect, findEnabledRedirect, listRedirects, saveRedirect } from "./redirects.repository";
import { z } from "zod";

export async function getRedirects() {
  return (await listRedirects()).map((row) => {
    const { id, sourcePath, destinationPath, statusCode, isEnabled, version } = row;

    return {
      id,
      version,
      ...redirectInputSchema.parse({ sourcePath, destinationPath, statusCode, isEnabled }),
    };
  });
}
export async function getEnabledRedirect(sourcePath: string) { return findEnabledRedirect(sourcePath); }
export async function writeRedirect(id: string | null, input: unknown, userId: string, expectedVersion?: number) { return saveRedirect(id, redirectInputSchema.parse(input), userId, undefined, { expectedVersion }); }
export async function deleteAdminRedirect(id: string, userId: string, expectedVersion?: number) { return z.string().uuid().safeParse(id).success ? deleteRedirect(id, userId, undefined, { expectedVersion }) : undefined; }
