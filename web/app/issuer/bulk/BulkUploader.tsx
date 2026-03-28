"use client";

import { useState, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import type { AnalyzeResponse, AttributeMapping } from "@/app/api/issuer/bulk/analyze/route";

// ── Column type inference ──────────────────────────────────────────────────────

type ColType = "email" | "number" | "date" | "text";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const DATE_RE = /^\d{4}[-/]\d{2}[-/]\d{2}$|^\d{2}[-/]\d{2}[-/]\d{4}$/;

function inferColType(values: string[]): ColType {
  const filled = values.filter(v => v && v.trim() !== "");
  if (filled.length === 0) return "text";
  if (filled.every(v => EMAIL_RE.test(v.trim()))) return "email";
  if (filled.every(v => NUMBER_RE.test(v.trim()))) return "number";
  if (filled.every(v => DATE_RE.test(v.trim()))) return "date";
  return "text";
}

const COL_TYPE_META: Record<ColType, { icon: string; label: string; className: string }> = {
  email:  { icon: "@",  label: "email",  className: "bg-blue-50 text-blue-600 border-blue-200" },
  number: { icon: "#",  label: "number", className: "bg-amber-50 text-amber-600 border-amber-200" },
  date:   { icon: "📅", label: "date",   className: "bg-purple-50 text-purple-600 border-purple-200" },
  text:   { icon: "Aa", label: "text",   className: "bg-gray-100 text-gray-500 border-gray-200" },
};

// ── CSV parser ─────────────────────────────────────────────────────────────────

function detectDelimiter(text: string): string {
  const firstLines = text.split(/\r?\n/).slice(0, 5).filter(l => l.trim());
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestScore = -1;
  for (const delim of candidates) {
    const counts = firstLines.map(l => l.split(delim).length - 1);
    const min = Math.min(...counts);
    const sum = counts.reduce((a, b) => a + b, 0);
    if (min > 0 && sum > bestScore) { bestScore = sum; best = delim; }
  }
  return best;
}

function parseCSV(text: string, delim?: string): string[][] {
  const sep = delim ?? detectDelimiter(text);
  const rows: string[][] = [];
  let col = "", row: string[] = [], inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { col += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === sep && !inQuote) {
      row.push(col); col = "";
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(col); col = "";
      if (row.some(c => c !== "")) rows.push(row);
      row = [];
    } else {
      col += ch;
    }
  }
  if (col || row.length) { row.push(col); if (row.some(c => c !== "")) rows.push(row); }
  return rows;
}

function parseFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const ext = file.name.split(".").pop()?.toLowerCase();

    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        if (ext === "csv" || ext === "txt") {
          const rows = parseCSV(content as string);
          const [headers, ...data] = rows;
          resolve({ headers, rows: data });
        } else {
          const wb = XLSX.read(content, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];
          const [headers, ...rowData] = data.filter(r => r.some(c => c != null && c !== ""));
          resolve({
            headers: headers.map(h => String(h ?? "")),
            rows: rowData.map(r => r.map(c => String(c ?? ""))),
          });
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);

    if (ext === "csv" || ext === "txt") {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

// ── Types ──────────────────────────────────────────────────────────────────────

type ParsedFile = { name: string; headers: string[]; rows: string[][] };

type RowResult = {
  row: number;
  status: "issued" | "sent" | "error";
  issuanceId?: string;
  email?: string;
  error?: string;
  accountStatus?: "created" | "existing" | "skipped";
  tempPassword?: string;
  recipientName?: string;
};

type Step = "drop" | "preview" | "analyzing" | "define-template" | "map-youth" | "issuing" | "done";

const DATA_TYPE_LABEL: Record<string, string> = {
  opportunity: "Opportunity / programme data",
  youth: "Participant data",
  combo: "Programme + participant data",
};

const DATA_TYPE_DESC: Record<string, string> = {
  opportunity: "This file describes a programme or opportunity. You'll need to add participant data separately.",
  youth: "This file contains participant records. Claude will suggest a credential template based on the columns.",
  combo: "Each row has both programme details and a participant. Claude has separated these for you below.",
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function BulkUploader() {
  const [step, setStep] = useState<Step>("drop");
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [mapping, setMapping] = useState<AttributeMapping[]>([]);
  const [emailColumn, setEmailColumn] = useState<string | null>(null);
  // Editable template fields (for define-template step)
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplateDesc, setEditTemplateDesc] = useState("");
  // Static values typed by the user for missing required attributes (attr → value)
  const [staticValues, setStaticValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<RowResult[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // ── File handling ────────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const { headers, rows } = await parseFile(file);
      if (headers.length === 0 || rows.length === 0) {
        setError("File appears to be empty or has no data rows.");
        return;
      }
      setParsed({ name: file.name, headers, rows });
      setStep("preview");
    } catch (err) {
      setError(`Could not parse file: ${String(err)}`);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // ── Analyze ──────────────────────────────────────────────────────────────────

  async function analyze() {
    if (!parsed) return;
    setStep("analyzing");
    setError(null);
    try {
      const res = await fetch("/api/issuer/bulk/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: parsed.headers,
          sampleRows: parsed.rows.slice(0, 5),
        }),
      });
      const data = (await res.json()) as AnalyzeResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysis(data);
      setMapping(data.mapping);
      setEmailColumn(data.emailColumn);
      // Pre-populate editable template fields
      setEditTemplateName(data.suggestedTemplateName ?? data.templateName ?? "");
      setEditTemplateDesc(data.suggestedTemplateDescription ?? "");
      setStep("define-template");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("preview");
    }
  }

  // ── Issue ────────────────────────────────────────────────────────────────────

  async function issue() {
    if (!parsed || !analysis) return;
    setStep("issuing");
    setResults([]);
    setStatusMsg("");
    setError(null);

    const body: Record<string, unknown> = {
      rows: parsed.rows.map(row =>
        Object.fromEntries(parsed.headers.map((h, i) => [h, row[i] ?? ""]))
      ),
      mapping,
      emailColumn,
      // Static values typed by user for missing required attributes
      staticAttributes: Object.fromEntries(
        Object.entries(staticValues).filter(([, v]) => v.trim() !== "")
      ),
    };

    if (analysis.mode === "existing") {
      body.templateId = analysis.templateId;
      body.templateName = analysis.templateName;
    } else {
      body.newTemplate = {
        name: editTemplateName,
        description: editTemplateDesc,
        code: editTemplateName
          .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        attributes: analysis.suggestedAttributes,
      };
    }

    try {
      const res = await fetch("/api/issuer/bulk/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok || !res.body) throw new Error(await res.text());

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if (event.type === "status") setStatusMsg(event.message);
            if (event.type === "template_created") setStatusMsg(`Template created: ${event.templateName}`);
            if (event.type === "row") setResults(prev => [...prev, event as RowResult]);
            if (event.type === "fatal") { setError(event.error); setStep("map-youth"); return; }
            if (event.type === "done") setStep("done");
          } catch { /* partial line */ }
        }
      }

      if (step !== "done") setStep("done");
    } catch (err) {
      setError(`Issuance failed: ${String(err)}`);
      setStep("map-youth");
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function updateMapping(index: number, field: "column" | "attribute", value: string) {
    setMapping(prev => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }

  function addMappingRow() {
    setMapping(prev => [...prev, { column: "", attribute: "" }]);
  }

  function removeMappingRow(index: number) {
    setMapping(prev => prev.filter((_, i) => i !== index));
  }

  function reset() {
    setStep("drop");
    setParsed(null);
    setAnalysis(null);
    setMapping([]);
    setEmailColumn(null);
    setEditTemplateName("");
    setEditTemplateDesc("");
    setStaticValues({});
    setResults([]);
    setStatusMsg("");
    setError(null);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* STEP: Drop */}
      {step === "drop" && (
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInput.current?.click()}
          className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
            dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-lg font-medium text-gray-700">Drop your file here</p>
          <p className="text-sm text-gray-500 mt-1">CSV, XLSX, or JSON — participant lists, programme data, or both</p>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx,.xls,.json,.txt"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      )}

      {/* STEP: Preview */}
      {step === "preview" && parsed && (() => {
        const colTypes = parsed.headers.map((_, j) =>
          inferColType(parsed.rows.map(r => r[j] ?? ""))
        );
        const fillRates = parsed.headers.map((_, j) => {
          const filled = parsed.rows.filter(r => r[j] && r[j].trim() !== "").length;
          return parsed.rows.length === 0 ? 0 : Math.round((filled / parsed.rows.length) * 100);
        });
        const PREVIEW_ROWS = 10;

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">{parsed.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {parsed.rows.length.toLocaleString()} rows · {parsed.headers.length} columns
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={reset} className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Change file
                </button>
                <button onClick={analyze} className="px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700">
                  Analyse with Claude
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {parsed.headers.map((h, j) => {
                const meta = COL_TYPE_META[colTypes[j]];
                return (
                  <span
                    key={h}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.className}`}
                  >
                    <span className="opacity-70">{meta.icon}</span>
                    {h}
                    {fillRates[j] < 100 && (
                      <span className="opacity-50">· {fillRates[j]}%</span>
                    )}
                  </span>
                );
              })}
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
              <table className="text-xs w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-2 py-0 w-8 bg-gray-50 border-r border-gray-200" />
                    {parsed.headers.map((h, j) => {
                      const meta = COL_TYPE_META[colTypes[j]];
                      const fill = fillRates[j];
                      return (
                        <th key={h} className="px-3 pt-2 pb-0 text-left whitespace-nowrap min-w-[120px]">
                          <div className="flex items-center gap-1 mb-1">
                            <span className={`text-[10px] font-bold px-1 py-0.5 rounded border ${meta.className}`}>
                              {meta.icon}
                            </span>
                            <span className="font-semibold text-gray-700">{h}</span>
                          </div>
                          <div className="h-0.5 w-full bg-gray-200 rounded-full mb-1.5">
                            <div
                              className={`h-0.5 rounded-full ${fill === 100 ? "bg-green-400" : fill >= 80 ? "bg-amber-400" : "bg-red-400"}`}
                              style={{ width: `${fill}%` }}
                            />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {parsed.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50/70">
                      <td className="px-2 py-2 text-center text-gray-300 font-mono text-[10px] border-r border-gray-100 select-none">
                        {i + 1}
                      </td>
                      {parsed.headers.map((_, j) => {
                        const val = row[j] ?? "";
                        const isEmpty = val.trim() === "";
                        return (
                          <td
                            key={j}
                            className={`px-3 py-2 whitespace-nowrap max-w-[200px] truncate ${
                              isEmpty ? "text-gray-300 italic" : "text-gray-700"
                            }`}
                            title={val || undefined}
                          >
                            {isEmpty ? "—" : val}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsed.rows.length > PREVIEW_ROWS && (
                <div className="px-3 py-2 border-t border-gray-100 bg-gray-50/50 flex items-center gap-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <p className="text-xs text-gray-400 whitespace-nowrap">
                    {(parsed.rows.length - PREVIEW_ROWS).toLocaleString()} more rows not shown
                  </p>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* STEP: Analyzing */}
      {step === "analyzing" && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          <p className="text-gray-600 font-medium">Claude is analysing your data…</p>
          <p className="text-sm text-gray-400">Classifying data type and matching credential templates</p>
        </div>
      )}

      {/* ── STEP 1: Define Template ─────────────────────────────────────────── */}
      {step === "define-template" && analysis && parsed && (
        <div className="space-y-5">
          {/* Progress indicator */}
          <StepIndicator current={1} />

          {/* Data type banner */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="text-lg mt-0.5">
                {analysis.dataType === "combo" ? "🔀" : analysis.dataType === "youth" ? "👥" : "📋"}
              </span>
              <div>
                <p className="font-medium text-gray-900">{DATA_TYPE_LABEL[analysis.dataType]}</p>
                <p className="text-sm text-gray-500 mt-0.5">{DATA_TYPE_DESC[analysis.dataType]}</p>
              </div>
            </div>
          </div>

          {/* Column classification (for combo) */}
          {analysis.dataType === "combo" && (
            <div className="grid grid-cols-2 gap-3">
              <ColumnGroup
                label="Programme columns"
                description="Same value across all rows — describes the opportunity"
                columns={analysis.opportunityColumns}
                colorClass="bg-indigo-50 text-indigo-700 border-indigo-200"
              />
              <ColumnGroup
                label="Participant columns"
                description="Unique per row — who completed it and their results"
                columns={analysis.youthColumns}
                colorClass="bg-teal-50 text-teal-700 border-teal-200"
              />
            </div>
          )}

          {/* Template match / suggestion */}
          <div className={`rounded-lg border p-4 ${analysis.mode === "existing" ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}>
            <div className="flex items-start gap-3 mb-3">
              <span className="text-xl">{analysis.mode === "existing" ? "✅" : "✨"}</span>
              <div>
                <p className="font-medium text-gray-900">
                  {analysis.mode === "existing"
                    ? `Matched existing template: "${analysis.templateName}" (${analysis.confidence}% confidence)`
                    : "New credential template"}
                </p>
                <p className="text-sm text-gray-600 mt-0.5">{analysis.reasoning}</p>
              </div>
            </div>

            {/* Editable template name & description */}
            <div className="space-y-2 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Template name</label>
                <input
                  value={editTemplateName}
                  onChange={e => setEditTemplateName(e.target.value)}
                  readOnly={analysis.mode === "existing"}
                  className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 ${
                    analysis.mode === "existing" ? "bg-white/60 text-gray-500 border-gray-200" : "bg-white border-gray-300"
                  }`}
                />
              </div>
              {analysis.mode === "new" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                  <textarea
                    value={editTemplateDesc}
                    onChange={e => setEditTemplateDesc(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 bg-white resize-none"
                  />
                </div>
              )}
            </div>

            {/* Attributes preview */}
            {analysis.mode === "existing" && analysis.templateAttributes && (
              <AttributesList attributes={analysis.templateAttributes} />
            )}
            {analysis.mode === "new" && analysis.suggestedAttributes && (
              <AttributesList attributes={analysis.suggestedAttributes} />
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              Start over
            </button>
            <button
              onClick={() => setStep("map-youth")}
              disabled={!editTemplateName.trim()}
              className="px-5 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm template →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Map Youth Data ──────────────────────────────────────────── */}
      {step === "map-youth" && analysis && parsed && (
        <div className="space-y-5">
          {/* Progress indicator */}
          <StepIndicator current={2} />

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="font-medium text-gray-900">Map participant data</p>
            <p className="text-sm text-gray-500 mt-0.5">
              Tell us which columns contain each participant&apos;s details and results — these become the credential attributes.
            </p>
          </div>

          {/* Email column picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email column <span className="text-gray-400 font-normal">(used to deliver the credential to each participant&apos;s wallet)</span>
            </label>
            <select
              value={emailColumn ?? ""}
              onChange={e => setEmailColumn(e.target.value || null)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <option value="">— no email / skip delivery —</option>
              {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          {/* Column → Attribute mapping */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-sm font-medium text-gray-700">Column → Credential attribute</p>
                <p className="text-xs text-gray-400 mt-0.5">Each mapped column becomes a field in the issued credential.</p>
              </div>
              <button onClick={addMappingRow} className="text-xs text-blue-600 hover:underline">+ Add row</button>
            </div>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto] text-xs font-medium text-gray-500 bg-gray-50 px-4 py-2">
                <span>File column</span>
                <span>Attribute name in credential</span>
                <span />
              </div>
              {mapping.map((m, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-4 py-2">
                  <select
                    value={m.column}
                    onChange={e => updateMapping(i, "column", e.target.value)}
                    className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                  >
                    <option value="">— select column —</option>
                    {parsed.headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <input
                    value={m.attribute}
                    onChange={e => updateMapping(i, "attribute", e.target.value)}
                    placeholder="attribute name"
                    className="border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                  <button onClick={() => removeMappingRow(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none">×</button>
                </div>
              ))}
              {mapping.length === 0 && (
                <p className="text-sm text-gray-400 px-4 py-3">No mappings — add one above.</p>
              )}
            </div>
          </div>

          {/* Missing required attributes — inline inputs */}
          {analysis.mode === "existing" && analysis.templateAttributes && (() => {
            const required = Object.entries(analysis.templateAttributes)
              .filter(([, v]) => (v as { required?: boolean }).required)
              .map(([k]) => k);
            const mapped = new Set(mapping.filter(m => m.attribute).map(m => m.attribute));
            const missing = required.filter(r => !mapped.has(r));
            if (missing.length === 0) return null;
            return (
              <div className="rounded-xl border border-amber-200 overflow-hidden">
                <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
                  <span className="text-amber-500 text-base">⚠</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Missing required attributes</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Enter a fixed value — it will be applied to every credential in this batch.
                    </p>
                  </div>
                </div>
                <div className="divide-y divide-amber-100 bg-white">
                  {missing.map(attr => (
                    <div key={attr} className="grid grid-cols-[1fr_1.5fr] items-center gap-3 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-sm font-mono text-gray-700">{attr}</span>
                        <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">required</span>
                      </div>
                      <input
                        type="text"
                        placeholder={`Value for ${attr} (same for all rows)`}
                        value={staticValues[attr] ?? ""}
                        onChange={e => setStaticValues(prev => ({ ...prev, [attr]: e.target.value }))}
                        className="border border-gray-200 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Credential preview for row 1 */}
          {mapping.length > 0 && parsed.rows.length > 0 && (() => {
            const tName = editTemplateName || "Credential";
            const claims: Record<string, string> = {};
            for (const { column, attribute } of mapping) {
              if (!column || !attribute) continue;
              const val = parsed.rows[0][parsed.headers.indexOf(column)] ?? "";
              if (val.trim()) claims[attribute] = val;
            }
            // Merge static values into preview
            for (const [attr, val] of Object.entries(staticValues)) {
              if (val.trim()) claims[attr] = val;
            }
            const emailIdx = emailColumn ? parsed.headers.indexOf(emailColumn) : -1;
            const email = emailIdx >= 0 ? (parsed.rows[0][emailIdx] ?? "") : "";
            return (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Preview — how row 1 will look as a credential
                </p>
                <CredentialBadge
                  templateName={tName}
                  claims={claims}
                  email={email}
                  index={0}
                  totalRows={parsed.rows.length}
                />
              </div>
            );
          })()}

          <div className="flex gap-2">
            <button onClick={() => setStep("define-template")} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              ← Back
            </button>
            <button
              onClick={issue}
              disabled={mapping.length === 0}
              className="px-5 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Issue {parsed.rows.length} credential{parsed.rows.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}

      {/* STEP: Issuing */}
      {step === "issuing" && (
        <div className="space-y-4">
          <StepIndicator current={3} />
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin flex-shrink-0" />
            <p className="text-sm text-gray-600">{statusMsg || "Issuing credentials…"}</p>
          </div>
          <IssueResultsTable results={results} total={parsed?.rows.length ?? 0} />
        </div>
      )}

      {/* STEP: Done */}
      {step === "done" && (
        <div className="space-y-5">
          {/* Summary banner */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">🎉</span>
              <p className="font-semibold text-green-800">
                {results.filter(r => r.status !== "error").length} of {results.length} credential{results.length !== 1 ? "s" : ""} issued successfully
              </p>
            </div>
            {emailColumn && (
              <p className="text-sm text-green-700 ml-11">
                {results.filter(r => r.status === "sent").length} sent to youth wallets
              </p>
            )}
          </div>

          {/* Account notifications panel */}
          <AccountNotificationsPanel results={results} templateName={editTemplateName} />

          {/* Row-level results table */}
          <IssueResultsTable results={results} total={results.length} />

          <button onClick={reset} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            Import another file
          </button>
        </div>
      )}
    </div>
  );
}

// ── Credential badge ───────────────────────────────────────────────────────────

const BADGE_COLORS = [
  { band: "from-blue-600 to-blue-800",       dot: "bg-blue-400",    footer: "bg-blue-50/60" },
  { band: "from-emerald-600 to-emerald-800", dot: "bg-emerald-400", footer: "bg-emerald-50/60" },
  { band: "from-violet-600 to-violet-800",   dot: "bg-violet-400",  footer: "bg-violet-50/60" },
  { band: "from-orange-500 to-orange-700",   dot: "bg-orange-400",  footer: "bg-orange-50/60" },
  { band: "from-rose-600 to-rose-800",       dot: "bg-rose-400",    footer: "bg-rose-50/60" },
];

function badgeColor(name: string) {
  const idx = (name ?? "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % BADGE_COLORS.length;
  return BADGE_COLORS[idx];
}

const NAME_FIELDS = new Set([
  "name", "fullName", "full_name", "participantName", "participant_name",
  "youthName", "youth_name",
  "firstName", "first_name", "First Name", "lastName", "last_name", "Last Name",
]);

function resolveDisplayName(claims: Record<string, string>, index: number): string {
  for (const k of ["name", "fullName", "full_name", "youthName", "participantName", "participant_name"]) {
    if (claims[k]?.trim()) return claims[k].trim();
  }
  const first = (claims["firstName"] || claims["first_name"] || claims["First Name"] || "").trim();
  const last  = (claims["lastName"]  || claims["last_name"]  || claims["Last Name"]  || "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return `Recipient ${index + 1}`;
}

function CredentialBadge({
  templateName,
  claims,
  email,
  index,
  totalRows,
}: {
  templateName: string;
  claims: Record<string, string>;
  email?: string;
  index: number;
  totalRows?: number;
}) {
  const color       = badgeColor(templateName);
  const displayName = resolveDisplayName(claims, index);
  const attrs       = Object.entries(claims)
    .filter(([k, v]) => !NAME_FIELDS.has(k) && v?.trim())
    .slice(0, 5);

  return (
    <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm max-w-sm">
      {/* Certificate header */}
      <div className={`bg-gradient-to-br ${color.band} px-5 pt-5 pb-6 relative overflow-hidden`}>
        {/* Decorative rings */}
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -right-2 -top-2 w-12 h-12 rounded-full border-2 border-white/20" />
        {/* Seal */}
        <div className="absolute right-4 top-4 w-10 h-10 rounded-full bg-white/15 border-2 border-white/30 flex items-center justify-center">
          <span className="text-white text-lg">🎓</span>
        </div>
        <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-1 relative z-10">
          Credential · Preview
        </p>
        <p className="text-white font-bold text-base leading-tight pr-12 relative z-10">
          {templateName}
        </p>
      </div>

      {/* Awarded to */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Awarded to</p>
        <p className="font-bold text-gray-900 text-lg">{displayName}</p>
      </div>

      {/* Attributes */}
      {attrs.length > 0 && (
        <div className="px-5 py-3 space-y-2">
          {attrs.map(([k, v]) => (
            <div key={k} className="flex items-start gap-2 text-sm">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${color.dot}`} />
              <span className="text-gray-400 shrink-0 w-28 truncate">{k}</span>
              <span className="text-gray-800 font-medium truncate flex-1">{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={`px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3 ${color.footer}`}>
        {email?.trim() ? (
          <span className="text-xs text-gray-500 truncate">{email}</span>
        ) : (
          <span className="text-xs text-amber-600 font-medium">⚠ No email set</span>
        )}
        {totalRows && totalRows > 1 && (
          <span className="text-xs text-gray-400 shrink-0">+{totalRows - 1} more</span>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Define template" },
    { n: 2, label: "Map participants" },
    { n: 3, label: "Issue & deliver" },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
            current === s.n
              ? "bg-gray-900 text-white"
              : current > s.n
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-400"
          }`}>
            <span>{current > s.n ? "✓" : s.n}</span>
            <span>{s.label}</span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 mx-1 ${current > s.n ? "bg-green-300" : "bg-gray-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ColumnGroup({
  label,
  description,
  columns,
  colorClass,
}: {
  label: string;
  description: string;
  columns: string[];
  colorClass: string;
}) {
  if (columns.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 p-3 bg-white">
      <p className="text-xs font-semibold text-gray-700">{label}</p>
      <p className="text-[11px] text-gray-400 mb-2">{description}</p>
      <div className="flex flex-wrap gap-1">
        {columns.map(c => (
          <span key={c} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colorClass}`}>
            {c}
          </span>
        ))}
      </div>
    </div>
  );
}

function AttributesList({
  attributes,
}: {
  attributes: Record<string, { type: string; required?: boolean; alwaysDisclosed?: boolean }>;
}) {
  const entries = Object.entries(attributes);
  if (entries.length === 0) return null;
  return (
    <div className="mt-3 rounded-md border border-gray-200 overflow-hidden bg-white">
      <div className="grid grid-cols-[1fr_auto_auto] text-[11px] font-medium text-gray-400 bg-gray-50 px-3 py-1.5">
        <span>Attribute</span>
        <span>Type</span>
        <span>Required</span>
      </div>
      {entries.map(([key, val]) => (
        <div key={key} className="grid grid-cols-[1fr_auto_auto] text-xs items-center px-3 py-1.5 border-t border-gray-100">
          <span className="font-mono text-gray-700">{key}</span>
          <span className="text-gray-400 mr-4">{val.type}</span>
          <span>{val.required ? <span className="text-amber-600 font-medium">required</span> : <span className="text-gray-300">—</span>}</span>
        </div>
      ))}
    </div>
  );
}

// ── Account notifications panel ────────────────────────────────────────────────

function MockEmail({
  to, name, tempPassword, templateName, isNew,
}: {
  to: string; name: string; tempPassword?: string; templateName: string; isNew: boolean;
}) {
  return (
    <div className="mt-2.5 rounded-lg border border-dashed border-gray-300 overflow-hidden text-xs">
      {/* Headers */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 space-y-1 font-mono">
        {[
          ["From", "no-reply@yoid.me"],
          ["To",   to],
          ["Subject", isNew
            ? "Your Me Wallet account & new credential"
            : `You have a new credential waiting in Me Wallet`],
        ].map(([label, value]) => (
          <div key={label} className="flex gap-2">
            <span className="w-14 text-right shrink-0 text-gray-400">{label}:</span>
            <span className={`text-gray-700 ${label === "Subject" ? "font-semibold" : ""}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="bg-white px-4 py-3 text-gray-700 space-y-2.5 leading-relaxed">
        <p>Hi {name},</p>

        {isNew ? (
          <>
            <p>
              Your credential <strong>"{templateName}"</strong> has been issued.
              We&apos;ve created a <strong>Me Wallet</strong> account for you so you can accept and
              manage your credentials.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 my-1">
              <p className="font-semibold text-blue-800 mb-1.5">Your account details</p>
              <div className="space-y-0.5 text-blue-700">
                <p>Email: <span className="font-mono">{to}</span></p>
                <p>Temporary password: <span className="font-mono font-bold tracking-wide">{tempPassword}</span></p>
              </div>
              <p className="text-[11px] text-blue-500 mt-1.5">Please change your password after your first login.</p>
            </div>
            <p>Once signed in, your credential will be waiting for you to accept.</p>
          </>
        ) : (
          <>
            <p>
              Your credential <strong>"{templateName}"</strong> has been issued and is
              waiting in your Me Wallet.
            </p>
            <p>Sign in to accept it.</p>
          </>
        )}

        <div className="pt-0.5">
          <span className="inline-block bg-gray-900 text-white px-4 py-1.5 rounded-md font-medium text-[11px]">
            Open Me Wallet →
          </span>
        </div>
        <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-100">
          This is an automated message from the YoID platform. Do not reply to this email.
        </p>
      </div>

      {/* Preview badge */}
      <div className="bg-amber-50 border-t border-amber-200 px-3 py-1.5 flex items-center gap-1.5">
        <span className="text-amber-500 text-sm">⚠</span>
        <span className="text-[11px] text-amber-700">
          Preview only — not sent. Connect an email service to deliver this automatically.
        </span>
      </div>
    </div>
  );
}

function AccountNotificationsPanel({
  results,
  templateName,
}: {
  results: RowResult[];
  templateName: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied]     = useState<string | null>(null);

  const newAccounts = results.filter(r => r.accountStatus === "created" && r.email);
  const existing    = results.filter(r => r.accountStatus === "existing" && r.email);

  if (newAccounts.length === 0 && existing.length === 0) return null;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const summary = [
    newAccounts.length > 0 && `${newAccounts.length} new`,
    existing.length    > 0 && `${existing.length} existing`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <span className="text-xl">📬</span>
        <div>
          <p className="font-semibold text-gray-900 text-sm">Account notifications</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {summary} · In production these would be sent via email automatically
          </p>
        </div>
      </div>

      {/* New accounts */}
      {newAccounts.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-blue-50/60 border-b border-blue-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">
              New accounts — temp password required to sign in
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {newAccounts.map(r => (
              <div key={r.email} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-gray-800 truncate">{r.email}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.tempPassword && (
                      <>
                        <code className="text-xs bg-gray-100 border border-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">
                          {r.tempPassword}
                        </code>
                        <button
                          onClick={() => copy(r.tempPassword!, r.email!)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium w-10 text-left"
                        >
                          {copied === r.email ? "✓" : "Copy"}
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => setExpanded(expanded === r.email ? null : r.email!)}
                      className="text-xs text-gray-400 hover:text-gray-700"
                    >
                      {expanded === r.email ? "Hide ▲" : "Preview email ▼"}
                    </button>
                  </div>
                </div>
                {expanded === r.email && (
                  <MockEmail
                    to={r.email!}
                    name={r.recipientName || r.email!.split("@")[0]}
                    tempPassword={r.tempPassword}
                    templateName={templateName}
                    isNew={true}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Existing accounts */}
      {existing.length > 0 && (
        <div className={newAccounts.length > 0 ? "border-t border-gray-200" : ""}>
          <div className="px-4 py-2 bg-green-50/60 border-b border-green-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <p className="text-[11px] font-semibold text-green-800 uppercase tracking-wider">
              Existing accounts — credential offer sent directly to wallet
            </p>
          </div>
          <div className="divide-y divide-gray-100">
            {existing.map(r => (
              <div key={r.email} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-700 truncate">{r.email}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-green-600 font-medium">✓ already registered</span>
                    <button
                      onClick={() => setExpanded(expanded === r.email ? null : r.email!)}
                      className="text-xs text-gray-400 hover:text-gray-700"
                    >
                      {expanded === r.email ? "Hide ▲" : "Preview email ▼"}
                    </button>
                  </div>
                </div>
                {expanded === r.email && (
                  <MockEmail
                    to={r.email!}
                    name={r.recipientName || r.email!.split("@")[0]}
                    templateName={templateName}
                    isNew={false}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Issue results table ─────────────────────────────────────────────────────────

function IssueResultsTable({ results, total }: { results: RowResult[]; total: number }) {
  if (results.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <table className="text-xs w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Row</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Email</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Issuance ID</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Note</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {results.map((r) => (
            <tr key={r.row} className="hover:bg-gray-50">
              <td className="px-3 py-2 text-gray-500">{r.row}</td>
              <td className="px-3 py-2">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                  r.status === "sent" ? "bg-green-100 text-green-700" :
                  r.status === "issued" ? "bg-blue-100 text-blue-700" :
                  "bg-red-100 text-red-700"
                }`}>
                  {r.status === "sent" ? "✓ sent" : r.status === "issued" ? "✓ issued" : "✗ error"}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600">{r.email ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-gray-500 truncate max-w-[140px]">{r.issuanceId ?? "—"}</td>
              <td className="px-3 py-2 text-gray-500 max-w-[320px]">
                {r.error ? (
                  <span className="block text-red-600 text-[11px] break-words whitespace-pre-wrap leading-snug" title={r.error}>
                    {r.error}
                  </span>
                ) : ""}
              </td>
            </tr>
          ))}
          {results.length < total && (
            <tr>
              <td colSpan={5} className="px-3 py-2 text-gray-400 italic">
                Issuing {results.length} of {total}…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
