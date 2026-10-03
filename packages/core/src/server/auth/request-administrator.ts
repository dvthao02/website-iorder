import { cookies } from "next/headers";

import { administratorSessionCookieName, getCurrentAdministrator } from "./auth.service";

export async function getRequestAdministrator() {
  const cookieStore = await cookies();

  return getCurrentAdministrator(cookieStore.get(administratorSessionCookieName)?.value);
}
