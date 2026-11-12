import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { getDb } from "@iorder/shared/db/client";
import { logger } from "@iorder/shared/server/shared/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("Health check thất bại: không kết nối được database.", { error });
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
