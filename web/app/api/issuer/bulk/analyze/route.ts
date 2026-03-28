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
  /** What kind of data this file contains */
  dataType: "opportunity" | "youth" | "combo";
  /** Columns that describe the opportunity/program (same value across all rows, or describing what the credential is) */
  opportunityColumns: string[];
  /** Columns that describe individual participants (name, email, grade, score, etc.) */
  youthColumns: string[];

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
  mapping: AttributeMapping[];   // column → attribute mappings (all columns, opp + youth)
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

    const prompt = `You are helping issue verifiable credentials on the YoID platform for youth development programmes.

A partner has uploaded a data file. Here are the columns and sample data:

COLUMNS: ${JSON.stringify(headers)}

SAMPLE DATA (up to 5 rows):
${sampleSection}

EXISTING CREDENTIAL TEMPLATES:
${templatesSection}

Your tasks:

1. CLASSIFY the data type:
   - "opportunity" — the file describes a programme/opportunity itself (e.g. course details, dates, provider). No individual participant rows.
   - "youth" — the file is purely a list of participants (names, emails, scores) with no programme metadata.
   - "combo" — the most common case: each row is a participant AND the programme info is embedded in columns (e.g. "Programme Name", "Start Date" alongside "Participant Name", "Score").

2. SPLIT columns into two groups:
   - opportunityColumns: columns that describe the opportunity/credential itself. These tend to have the same value across all rows (e.g. "Course Name", "Provider", "Start Date", "End Date").
   - youthColumns: columns that identify individual participants or their results (e.g. "Name", "Email", "Score", "Grade", "Completion Date"). Include the email column here.

3. TEMPLATE MATCHING: Determine if an existing template is a strong fit (≥70% of meaningful columns map to attributes). If yes, return its ID and a precise column→attribute mapping. The "attribute" value MUST be the exact key from the template's attributes JSON — not a display name or guess. If no template fits, suggest a new one derived from the data. The template should capture what the CREDENTIAL is about (use opportunity columns + any per-participant attributes).

4. MAPPING: Return a mapping of file columns → credential attribute names. This covers both opportunity-level and youth-level columns (except the email column, which is handled separately).

5. EMAIL: Identify which column holds participant email addresses (return null if none).

Return ONLY valid JSON matching this exact shape:
{
  "dataType": "opportunity" | "youth" | "combo",
  "opportunityColumns": ["<col>", ...],
  "youthColumns": ["<col>", ...],
  "mode": "existing" | "new",
  "templateId": "<id if mode=existing>",
  "templateName": "<name if mode=existing>",
  "confidence": <0-100 if mode=existing>,
  "suggestedTemplateName": "<name if mode=new>",
  "suggestedTemplateDescription": "<description if mode=new>",
  "suggestedAttributes": { "<attrName>": { "type": "string"|"number"|"date", "alwaysDisclosed": true|false } },
  "mapping": [ { "column": "<file column>", "attribute": "<template attribute>" } ],
  "emailColumn": "<column name>" | null,
  "reasoning": "<brief explanation of data type classification and template decision>"
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

    // Ensure arrays are present (defensive)
    result.opportunityColumns ??= [];
    result.youthColumns ??= [];

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
