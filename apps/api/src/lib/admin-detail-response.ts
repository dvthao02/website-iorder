import { NextResponse } from "next/server";

/** Keep missing content distinct from failed reads, without leaking exceptions. */
export async function adminDetailResponse<T>(key: "post" | "offering", read: () => Promise<T | undefined>, messages: { missing: string; failed: string }) {
  try {
    const item = await read();
    return item === undefined
      ? NextResponse.json({ error: { code: "NOT_FOUND", message: messages.missing } }, { status: 404 })
      : NextResponse.json({ [key]: item });
  } catch {
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: messages.failed } }, { status: 500 });
  }
}
