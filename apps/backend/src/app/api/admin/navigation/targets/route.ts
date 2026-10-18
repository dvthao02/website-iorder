import { NextResponse } from "next/server";

import { getRequestAdministrator } from "@iorder/core/server/auth/request-administrator";
import { getPublishedNavigationTargets } from "@iorder/core/server/navigation/navigation.service";
import { withRequestContext } from "@/lib/request-context";

async function handleGET() {
  const user = await getRequestAdministrator();
  if (!user) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Vui lòng đăng nhập lại." } }, { status: 401 });
  return NextResponse.json({ targets: await getPublishedNavigationTargets() });
}

export const GET = withRequestContext(handleGET);
