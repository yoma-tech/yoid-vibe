import { errMsg } from "@/lib/errors";
import { NextResponse } from "next/server";
import { getPresentation } from "@/lib/yoid";
import { updatePresentationRequestStatus, upsertTalentProfile, saveTalentCredential } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const presentation = await getPresentation(id);

    // If verified, sync to talent pool
    if (presentation.status === "verified") {
      updatePresentationRequestStatus(id, "verified", presentation.credentials);

      for (const cred of presentation.credentials) {
        if (!cred.isValid) continue;
        const attrs = cred.attributes;
        const fullName = attrs.fullName ?? "";
        const [firstName = "", ...rest] = fullName.split(" ");
        const lastName = rest.join(" ");
        const profileId = `profile-${id}-${cred.type}`;

        upsertTalentProfile({ id: profileId, firstName, lastName, email: attrs.email ?? undefined });
        saveTalentCredential({
          id: `cred-${id}-${cred.type}`,
          profileId,
          credentialName: cred.name,
          credentialType: cred.type,
          attributes: attrs,
          presentationRequestId: id,
        });
      }
    }

    return NextResponse.json({ presentation });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
