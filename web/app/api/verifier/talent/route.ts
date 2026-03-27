import { errMsg } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { searchTalentPool, getAllTalentProfiles } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("q") ?? "";
    const profiles = query.trim()
      ? searchTalentPool(query)
      : getAllTalentProfiles();
    return NextResponse.json({ profiles });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
