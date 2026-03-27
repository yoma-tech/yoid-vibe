import { errMsg } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import {
  createPresentationTemplate,
  createPresentationRequest,
  listPresentationTemplates,
} from "@/lib/yoid";
import { savePresentationRequest } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      // Either pass a templateId directly, or pass template definition to create one
      templateId?: string;
      templateName?: string;
      credentialType: string;
      attributes: Record<string, { type: string }>;
    };

    let templateId = body.templateId;
    let templateName = body.templateName ?? "Verification Request";

    if (!templateId) {
      // Create a new presentation template on the fly
      const template = await createPresentationTemplate({
        name: templateName,
        description: `Verification request for ${body.credentialType}`,
        credentials: [
          {
            name: templateName,
            description: `Request for ${body.credentialType}`,
            type: body.credentialType,
            attributes: body.attributes,
          },
        ],
      });
      templateId = template.id;
      templateName = template.name;
    }

    const request = await createPresentationRequest(templateId);

    savePresentationRequest({
      id: request.id,
      templateId,
      templateName,
      status: request.status,
      authorizationRequestUri: request.authorizationRequestUri,
      authorizationRequestQrUri: request.authorizationRequestQrUri,
    });

    return NextResponse.json({ request });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
