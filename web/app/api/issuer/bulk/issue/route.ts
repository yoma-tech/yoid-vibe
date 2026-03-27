import { NextRequest } from "next/server";
import {
  issueCredential,
  createCredentialTemplate,
  createUserAccount,
  sendCredentialToWallet,
} from "@/lib/yoid";
import { saveIssuance, updateIssuanceHolderEmail } from "@/lib/db";
import { errMsg } from "@/lib/errors";
import type { AttributeMapping } from "../analyze/route";

type BulkIssueRequest = {
  rows: Record<string, string>[];
  mapping: AttributeMapping[];       // column → attribute
  emailColumn: string | null;        // column that holds recipient email
  // Existing template
  templateId?: string;
  templateName?: string;
  // New template to create first
  newTemplate?: {
    name: string;
    description: string;
    code: string;
    attributes: Record<string, { type: string; alwaysDisclosed: boolean }>;
  };
};

type RowResult = {
  row: number;
  status: "issued" | "sent" | "error";
  issuanceId?: string;
  email?: string;
  error?: string;
};

function encoder() {
  return new TextEncoder();
}

function send(controller: ReadableStreamDefaultController, data: object) {
  controller.enqueue(encoder().encode(JSON.stringify(data) + "\n"));
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as BulkIssueRequest;
  const { rows, mapping, emailColumn, newTemplate } = body;
  let { templateId, templateName } = body;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: create template if needed
        if (newTemplate && !templateId) {
          send(controller, { type: "status", message: "Creating credential template…" });
          try {
            const created = await createCredentialTemplate({
              name: newTemplate.name,
              description: newTemplate.description,
              code: newTemplate.code,
              attributes: newTemplate.attributes,
            });
            templateId = created.id;
            templateName = created.name;
            send(controller, { type: "template_created", templateId, templateName });
          } catch (err) {
            send(controller, { type: "fatal", error: `Failed to create template: ${errMsg(err)}` });
            controller.close();
            return;
          }
        }

        if (!templateId) {
          send(controller, { type: "fatal", error: "No template ID available" });
          controller.close();
          return;
        }

        send(controller, { type: "status", message: `Issuing ${rows.length} credential(s)…` });

        // Step 2: issue each row
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const attributes: Record<string, string> = {};
          for (const { column, attribute } of mapping) {
            const val = row[column];
            if (val !== undefined && val !== "") {
              attributes[attribute] = val;
            }
          }

          const email = emailColumn ? row[emailColumn] : undefined;
          const result: RowResult = { row: i + 1, status: "issued", email };

          console.log(`[bulk] row ${i + 1} attributes:`, JSON.stringify(attributes));
          try {
            const record = await issueCredential({ credentialTemplateId: templateId, attributes });
            result.issuanceId = record.id;

            saveIssuance({
              id: record.id,
              credentialId: record.credentials?.[0]?.id,
              credentialTemplateId: templateId,
              credentialTemplateName: templateName,
              claims: attributes,
              status: record.status,
              offerUri: record.offerUri,
              offerQrUri: record.offerQrUri,
            });

            // Step 3: send to wallet if email present
            if (email && record.offerUri) {
              try {
                const firstName = String(row["firstName"] || row["first_name"] || row["First Name"] || "").trim();
                const lastName = String(row["lastName"] || row["last_name"] || row["Last Name"] || "").trim();

                // Create account (idempotent)
                try {
                  await createUserAccount({ email, firstName: firstName || "Unknown", lastName: lastName || "User" });
                } catch (err) {
                  const msg = errMsg(err).toLowerCase();
                  const isDuplicate =
                    msg.includes("400") || msg.includes("409") || msg.includes("already") ||
                    msg.includes("exists") || msg.includes("conflict") || msg.includes("duplicate");
                  if (!isDuplicate) throw err;
                }

                await sendCredentialToWallet(record.offerUri, email);
                updateIssuanceHolderEmail(record.id, email);
                result.status = "sent";
              } catch (sendErr) {
                // Issued but not sent — partial success
                result.status = "issued";
                result.error = `Issued but send failed: ${errMsg(sendErr)}`;
              }
            }
          } catch (err) {
            result.status = "error";
            result.error = errMsg(err);
          }

          send(controller, { type: "row", ...result });
        }

        send(controller, { type: "done", total: rows.length });
      } catch (err) {
        send(controller, { type: "fatal", error: errMsg(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}
