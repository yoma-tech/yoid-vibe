import { NextRequest, NextResponse } from "next/server";
import {
  saveWebhookEvent,
  isWebhookProcessed,
  markWebhookProcessed,
  updateIssuanceStatus,
  updatePresentationRequestStatus,
  upsertTalentProfile,
  saveTalentCredential,
} from "@/lib/db";
import { getIssuance, getPresentation } from "@/lib/yoid";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  // If a secret is configured, require it in the Authorization header
  if (WEBHOOK_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = (await req.json()) as {
    eventType: string;
    payload: Record<string, string>;
  };

  // Deduplicate using webhook-id header
  const webhookId =
    req.headers.get("webhook-id") ?? `${body.eventType}-${Date.now()}`;

  if (isWebhookProcessed(webhookId)) {
    return NextResponse.json({ ok: true });
  }

  saveWebhookEvent({
    id: webhookId,
    eventType: body.eventType,
    payload: body.payload,
  });

  // Respond immediately — process async
  setImmediate(async () => {
    try {
      await handleEvent(body.eventType, body.payload);
      markWebhookProcessed(webhookId);
    } catch (err) {
      console.error("[webhook] processing error", err);
    }
  });

  return NextResponse.json({ ok: true });
}

async function handleEvent(
  eventType: string,
  payload: Record<string, string>
) {
  switch (eventType) {
    case "openid4vc.issuance.completed":
    case "openid4vc.issuance.failed":
    case "openid4vc.issuance.expired": {
      const id = payload.openId4VcIssuanceId;
      if (!id) break;
      const status =
        eventType === "openid4vc.issuance.completed"
          ? "completed"
          : eventType === "openid4vc.issuance.failed"
          ? "failed"
          : "expired";
      updateIssuanceStatus(id, status);
      break;
    }

    case "openid4vc.presentation.verified": {
      const id = payload.openId4VcPresentationId;
      if (!id) break;

      // Fetch full presentation from API to get the credential attributes
      const presentation = await getPresentation(id);
      updatePresentationRequestStatus(id, "verified", presentation.credentials);

      // Index verified youth data into the talent pool
      for (const cred of presentation.credentials) {
        if (!cred.isValid) continue;
        const attrs = cred.attributes;
        const fullName = attrs.fullName ?? "";
        const [firstName = "", ...rest] = fullName.split(" ");
        const lastName = rest.join(" ");
        const profileId = `profile-${id}-${cred.type}`;

        upsertTalentProfile({
          id: profileId,
          firstName,
          lastName,
          email: attrs.email ?? undefined,
        });

        saveTalentCredential({
          id: `cred-${id}-${cred.type}`,
          profileId,
          credentialName: cred.name,
          credentialType: cred.type,
          attributes: attrs,
          presentationRequestId: id,
        });
      }
      break;
    }

    case "openid4vc.presentation.failed":
    case "openid4vc.presentation.expired": {
      const id = payload.openId4VcPresentationId;
      if (!id) break;
      const status =
        eventType === "openid4vc.presentation.failed" ? "rejected" : "expired";
      updatePresentationRequestStatus(id, status);
      break;
    }

    default:
      console.log("[webhook] unhandled event:", eventType);
  }
}
