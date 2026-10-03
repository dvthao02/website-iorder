import { redirectInputSchema } from "./redirects.contract";
import { findEnabledRedirect, listRedirects, saveRedirect } from "./redirects.repository";

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
