import { errMsg } from "@/lib/errors";
import { NextResponse } from "next/server";
import { registerWebhook, listWebhookEndpoints } from "@/lib/yoid";

export async function POST() {
  try {
    const baseUrl = process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000";
    const webhookUrl = `${baseUrl}/api/webhooks/yoid`;
    const endpoint = await registerWebhook(webhookUrl);
    return NextResponse.json({ endpoint });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const endpoints = await listWebhookEndpoints();
    return NextResponse.json({ endpoints });
  } catch (err) {
    return NextResponse.json({ error: errMsg(err) }, { status: 500 });
  }
}
