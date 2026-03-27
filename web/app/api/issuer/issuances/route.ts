import { errMsg } from "@/lib/errors";
import { NextResponse } from "next/server";
import { getIssuances } from "@/lib/db";

export async function GET() {
  try {
    const issuances = getIssuances();
    return NextResponse.json({ issuances });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
