import { errMsg } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { issueCredential, listCredentialTemplates } from "@/lib/yoid";
import { saveIssuance } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      credentialTemplateId: string;
      attributes: Record<string, string>;
    };

    const record = await issueCredential({
      credentialTemplateId: body.credentialTemplateId,
      attributes: body.attributes,
    });

    // Look up template name for display
    let templateName: string | undefined;
    try {
      const templates = await listCredentialTemplates();
      templateName = templates.find((t) => t.id === body.credentialTemplateId)?.name;
    } catch {
      // non-fatal
    }

    saveIssuance({
      id: record.id,
      credentialId: record.credentials?.[0]?.id,
      credentialTemplateId: body.credentialTemplateId,
      credentialTemplateName: templateName,
      claims: body.attributes,
      status: record.status,
      offerUri: record.offerUri,
      offerQrUri: record.offerQrUri,
    });

    return NextResponse.json({ record, issuanceId: record.id });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
