import { errMsg } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import { createUserAccount, sendCredentialToWallet } from "@/lib/yoid";
import { getIssuance, updateIssuanceHolderEmail } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      issuanceId: string;
      email: string;
      firstName: string;
      lastName: string;
    };

    const issuance = getIssuance(body.issuanceId);
    if (!issuance) {
      return NextResponse.json({ error: "Issuance not found" }, { status: 404 });
    }
    if (!issuance.offerUri) {
      return NextResponse.json({ error: "No offer URI — credential may have expired" }, { status: 400 });
    }

    // Ensure the youth has a wallet account (idempotent — ignore if already exists)
    let accountCreated = false;
    try {
      await createUserAccount({
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
      });
      accountCreated = true;
    } catch (err) {
      // If account already exists the API returns an error — that's fine, continue to send
      // Docs say duplicate account returns 400 — swallow it and proceed to send
      const msg = errMsg(err).toLowerCase();
      const isDuplicate = msg.includes("400") || msg.includes("409") || msg.includes("already") || msg.includes("exists") || msg.includes("conflict") || msg.includes("duplicate");
      if (!isDuplicate) throw err;
    }

    await sendCredentialToWallet(issuance.offerUri, body.email);

    updateIssuanceHolderEmail(body.issuanceId, body.email);

    return NextResponse.json({ ok: true, accountCreated });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
