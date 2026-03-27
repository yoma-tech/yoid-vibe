import { errMsg } from "@/lib/errors";
import { NextResponse } from "next/server";
import { revokeCredential } from "@/lib/yoid";
import { getIssuance, updateIssuanceStatus } from "@/lib/db";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const issuance = getIssuance(id);
    if (!issuance?.credentialId) {
      return NextResponse.json({ error: "Credential ID not found — cannot revoke" }, { status: 404 });
    }
    await revokeCredential(issuance.credentialId);
    updateIssuanceStatus(id, "revoked");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = errMsg(err);
    if (msg.includes("already revoked")) {
      updateIssuanceStatus(id, "revoked");
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
