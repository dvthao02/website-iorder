import { NextResponse } from "next/server";
import { getMediaById } from "@iorder/core/server/media/media.service";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({ asset: await getMediaById(id) });
}
