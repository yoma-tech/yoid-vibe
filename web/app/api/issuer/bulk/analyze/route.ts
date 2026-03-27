import { errMsg } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { listCredentialTemplates } from "@/lib/yoid";
import type { CredentialTemplate } from "@/lib/yoid";

// Instantiated lazily so env vars are guaranteed to be loaded
function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export type AnalyzeRequest = {
  headers: string[];
  sampleRows: string[][];
};

export type AttributeMapping = {
  column: string;       // source column name from the file
  attribute: string;    // target attribute name in the template
};

export type AnalyzeResponse = {
  mode: "existing" | "new";
  // mode=existing: matched an existing template
  templateId?: string;
  templateName?: string;
  confidence?: number;
  templateAttributes?: Record<string, { type: string; required?: boolean; alwaysDisclosed?: boolean }>;
  // mode=new: suggest creating a template from the data
  suggestedTemplateName?: string;
  suggestedTemplateDescription?: string;
  suggestedAttributes?: Record<string, { type: string; alwaysDisclosed: boolean }>;
  // shared
  mapping: AttributeMapping[];   // column → attribute mappings
  emailColumn: string | null;    // which column holds recipient email
  reasoning: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AnalyzeRequest;
    const { headers, sampleRows } = body;

    let templates: CredentialTemplate[] = [];
    try {
      templates = await listCredentialTemplates();
    } catch {
      // Non-fatal — proceed with no existing templates
    }

    const templatesSection =
      templates.length === 0
        ? "No existing credential templates."
        : templates
            .map(
              (t) =>
                `Template ID: ${t.id}\nName: ${t.name}\nDescription: ${t.description}\nAttributes: ${JSON.stringify(t.attributes, null, 2)}`
            )
            .join("\n\n---\n\n");

    const sampleSection = sampleRows
      .slice(0, 5)
      .map((row, i) => `Row ${i + 1}: ${JSON.stringify(Object.fromEntries(headers.map((h, j) => [h, row[j] ?? ""])))}`
      )
      .join("\n");

    const prompt = `You are helping issue verifiable credentials on the YoID platform.

A user has uploaded a data file with the following columns and sample data:

COLUMNS: ${JSON.stringify(headers)}

SAMPLE DATA (up to 5 rows):
${sampleSection}

EXISTING CREDENTIAL TEMPLATES:
${templatesSection}

Your task:
1. Determine if one of the existing templates is a strong fit for this data. A strong fit means ≥70% of the meaningful data columns map naturally to template attributes (ignoring email/name columns for this threshold).
2. If a template fits, return its ID and a mapping of file columns to template attributes. CRITICAL: the "attribute" value in each mapping entry MUST be the EXACT key from the template's "attributes" object as shown above — not a display name, not a guess. Only use keys that literally appear in that template's attributes JSON.
3. If no template fits well, suggest a new template: give it a name, description, and a set of attributes derived from the column names and sample data values. Infer attribute types: "string" for text, "number" for numeric values, "date" for dates.
4. Always identify which column contains email addresses (this is used to deliver the credential to the recipient's wallet). If no email column exists, return null.
5. For the mapping, only include columns that map to credential attributes — not the email column itself (that's handled separately).
6. IMPORTANT: only map a column to an attribute if you are confident it is a genuine match. It is better to have fewer mappings than to include a wrong one that will fail validation.

Return ONLY valid JSON matching this exact shape:
{
  "mode": "existing" | "new",
  "templateId": "<id if mode=existing>",
  "templateName": "<name if mode=existing>",
  "confidence": <0-100 if mode=existing>,
  "suggestedTemplateName": "<name if mode=new>",
  "suggestedTemplateDescription": "<description if mode=new>",
  "suggestedAttributes": { "<attrName>": { "type": "string"|"number"|"date", "alwaysDisclosed": true|false } } (if mode=new),
  "mapping": [ { "column": "<file column>", "attribute": "<template attribute>" } ],
  "emailColumn": "<column name>" | null,
  "reasoning": "<brief explanation of your decision>"
}`;

    const message = await getAnthropic().messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude did not return valid JSON");

    const result = JSON.parse(jsonMatch[0]) as AnalyzeResponse;

    // Attach the real template attributes so the UI can show required field validation
    if (result.mode === "existing" && result.templateId) {
      const matched = templates.find(t => t.id === result.templateId);
      if (matched) result.templateAttributes = matched.attributes as AnalyzeResponse["templateAttributes"];
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = errMsg(err);
    // Translate Anthropic overload into a friendly message
    const friendly = msg.includes("529") || msg.includes("overloaded")
      ? "Claude is overloaded right now — please try again in a few seconds."
      : msg;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
