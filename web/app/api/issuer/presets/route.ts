import { errMsg } from "@/lib/errors";
import { NextResponse } from "next/server";
import { listEcosystemPresets } from "@/lib/yoid";

// Filter out the didxyz test/postman entries which make up 90% of the list
const EXCLUDED_AUTHORS = new Set(["didxyz"]);

export async function GET() {
  try {
    const all = await listEcosystemPresets();

    // Deduplicate by templateType (keep first occurrence), exclude test authors
    const seen = new Set<string>();
    const presets = all.filter((p) => {
      if (EXCLUDED_AUTHORS.has(p.author)) return false;
      if (seen.has(p.templateType)) return false;
      seen.add(p.templateType);
      return true;
    });

    return NextResponse.json({ presets });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
