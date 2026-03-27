"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CredentialTemplate, IssuanceRecord } from "@/lib/yoid";
import { QRCodeImage } from "@/components/QRCodeImage";

type SendStatus = "idle" | "creating-account" | "sending" | "sent";

export function IssueForm({
  templates,
  defaultTemplateId,
}: {
  templates: CredentialTemplate[];
  defaultTemplateId?: string;
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(defaultTemplateId ?? "");
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ record: IssuanceRecord; issuanceId: string } | null>(null);

  // Send-to-youth state
  const [sendEmail, setSendEmail] = useState("");
  const [sendFirstName, setSendFirstName] = useState("");
  const [sendLastName, setSendLastName] = useState("");
  const [sendStatus, setSendStatus] = useState<SendStatus>("idle");
  const [sendError, setSendError] = useState<string | null>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId);

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    setClaims({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTemplate) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/issuer/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentialTemplateId: templateId,
          attributes: claims,
        }),
      });

      const data = await res.json() as { record?: IssuanceRecord; issuanceId?: string; error?: string };
      if (!res.ok) throw new Error(data.error);
      setIssued({ record: data.record!, issuanceId: data.issuanceId! });
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!issued) return;
    setSendError(null);
    setSendStatus("creating-account");

    try {
      const res = await fetch("/api/issuer/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issuanceId: issued.issuanceId,
          email: sendEmail,
          firstName: sendFirstName,
          lastName: sendLastName,
        }),
      });

      const data = await res.json() as { ok?: boolean; accountCreated?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error);
      setSendStatus("sent");
    } catch (err) {
      setSendError(String(err));
      setSendStatus("idle");
    }
  }

  if (issued) {
    return (
      <div className="space-y-4">
        {/* Credential issued */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">✅</span>
            <div>
              <h3 className="font-semibold text-gray-900">Credential issued</h3>
              <p className="text-sm text-gray-500">Youth can scan the QR code to accept it in their wallet.</p>
            </div>
          </div>
          {issued.record.offerQrUri && (
            <div className="flex flex-col items-center mb-4">
              <QRCodeImage data={issued.record.offerQrUri} size={192} className="rounded-lg" alt="Credential offer QR" />
            </div>
          )}
          {issued.record.offerUri && (
            <a
              href={issued.record.offerUri}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm text-blue-600 hover:underline"
            >
              Or open link directly →
            </a>
          )}
        </div>

        {/* Send to youth */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">Send to youth</h3>
          <p className="text-sm text-gray-500 mb-4">
            Enter the youth&apos;s details to deliver the credential to their wallet. If they don&apos;t have an
            account yet, one will be created for them.
          </p>

          {sendStatus === "sent" ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-4 py-3 text-sm">
              <span>✓</span>
              <span>Sent to <strong>{sendEmail}</strong> — they&apos;ll receive an email to accept the credential.</span>
            </div>
          ) : (
            <form onSubmit={handleSend} className="space-y-3">
              {sendError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {sendError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={sendEmail}
                  onChange={(e) => setSendEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder="amara@example.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
                  <input
                    type="text"
                    value={sendFirstName}
                    onChange={(e) => setSendFirstName(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Amara"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
                  <input
                    type="text"
                    value={sendLastName}
                    onChange={(e) => setSendLastName(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                    placeholder="Dlamini"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={sendStatus !== "idle"}
                className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {sendStatus === "creating-account" ? "Creating account…" :
                 sendStatus === "sending" ? "Sending…" : "Send credential"}
              </button>
            </form>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setIssued(null);
              setClaims({});
              setSendEmail("");
              setSendFirstName("");
              setSendLastName("");
              setSendStatus("idle");
              setSendError(null);
            }}
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Issue another
          </button>
          <button
            onClick={() => router.push("/issuer")}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Credential template
          </label>
          <select
            value={templateId}
            onChange={(e) => handleTemplateChange(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
          >
            <option value="">Select a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {templates.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">
              No templates found.{" "}
              <a href="/issuer/templates/new" className="underline">
                Create one first.
              </a>
            </p>
          )}
        </div>
      </div>

      {selectedTemplate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-medium text-gray-900 mb-4">Credential details</h3>
          <div className="space-y-3">
            {Object.entries(selectedTemplate.attributes).map(([key, attr]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {key}
                  {attr.alwaysDisclosed && (
                    <span className="ml-2 text-xs text-green-600 font-normal">
                      always disclosed
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={claims[key] ?? ""}
                  onChange={(e) =>
                    setClaims((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                  placeholder={attr.type}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !selectedTemplate}
          className="bg-gray-900 text-white text-sm px-6 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Issuing…" : "Issue credential"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
