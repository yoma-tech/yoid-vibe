import { errMsg } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { listCredentialTemplates, createCredentialTemplate } from "@/lib/yoid";

export async function GET() {
  try {
    const templates = await listCredentialTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      name: string;
      description: string;
      code?: string;
      type?: string;
      attributes: Record<string, { type: string; alwaysDisclosed?: boolean }>;
    };
    const template = await createCredentialTemplate(body);
    return NextResponse.json({ template });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
