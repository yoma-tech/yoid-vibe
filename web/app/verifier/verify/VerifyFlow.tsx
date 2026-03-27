"use client";

import { useState, useEffect, useRef } from "react";
import type { PresentationTemplate, PresentationRequest } from "@/lib/yoid";
import clsx from "clsx";
import { QRCodeImage } from "@/components/QRCodeImage";

type Step = "configure" | "qr" | "result";

const STATUS_POLL_INTERVAL = 3000;

export function VerifyFlow({
  existingTemplates,
}: {
  existingTemplates: PresentationTemplate[];
}) {
  const [step, setStep] = useState<Step>("configure");
  const [mode, setMode] = useState<"existing" | "new">(
    existingTemplates.length > 0 ? "existing" : "new"
  );
  const [templateId, setTemplateId] = useState(existingTemplates[0]?.id ?? "");
  const [credentialType, setCredentialType] = useState("");
  const [templateName, setTemplateName] = useState("");

  const [request, setRequest] = useState<PresentationRequest | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function createRequest() {
    setSubmitting(true);
    setError(null);

    try {
      const body =
        mode === "existing"
          ? { templateId }
          : {
              credentialType,
              templateName: templateName || `${credentialType} Verification`,
              attributes: { fullName: { type: "string" }, completionDate: { type: "string" } },
            };

      const res = await fetch("/api/verifier/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json() as { request?: PresentationRequest; error?: string };
      if (!res.ok) throw new Error(data.error);

      setRequest(data.request!);
      setStep("qr");
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Poll for status changes after QR is displayed
  useEffect(() => {
    if (step !== "qr" || !request) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/verifier/status/${request.id}`);
        const data = await res.json() as { presentation: PresentationRequest };
        const status = data.presentation.status;

        if (status !== "requested") {
          setRequest(data.presentation);
          setStep("result");
          clearInterval(pollRef.current!);
        }
      } catch {
        // silent — we'll keep polling
      }
    }, STATUS_POLL_INTERVAL);

    return () => clearInterval(pollRef.current!);
  }, [step, request]);

  function reset() {
    setStep("configure");
    setRequest(null);
    setError(null);
  }

  if (step === "qr" && request) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
        <div className="mb-2">
          <span className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
            Waiting for youth to scan…
          </span>
        </div>
        <h3 className="font-semibold text-gray-900 mb-1 mt-3">Scan to verify credentials</h3>
        <p className="text-sm text-gray-500 mb-5">
          Youth scans this with their DIDx:Me wallet and selects which credentials to share.
        </p>
        <QRCodeImage data={request.authorizationRequestQrUri} size={224} className="mx-auto rounded-lg mb-4" alt="Verification QR" />
        <a
          href={request.authorizationRequestUri}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-blue-600 hover:underline mb-6"
        >
          Or open link directly →
        </a>
        <button
          onClick={reset}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Cancel and start over
        </button>
      </div>
    );
  }

  if (step === "result" && request) {
    const verified = request.status === "verified";
    const validCredentials = request.credentials.filter((c) => c.isValid);

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className={clsx(
          "text-center mb-6",
          verified ? "text-green-600" : "text-red-500"
        )}>
          <div className="text-4xl mb-2">{verified ? "✅" : "❌"}</div>
          <h3 className="font-semibold text-lg">
            {verified
              ? "Verification successful"
              : request.status === "rejected"
              ? "Youth declined"
              : "Verification expired"}
          </h3>
          {verified && (
            <p className="text-sm text-gray-500 mt-1">
              Youth&apos;s profile has been added to the talent pool.
            </p>
          )}
        </div>

        {verified && validCredentials.length > 0 && (
          <div className="space-y-4 mb-6">
            {validCredentials.map((cred, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-800">{cred.name}</span>
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">
                    cryptographically verified
                  </span>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(cred.attributes).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-medium text-gray-800">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            New verification request
          </button>
          <a
            href="/verifier"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center"
          >
            View talent pool →
          </a>
        </div>
      </div>
    );
  }

  // Step: configure
  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {existingTemplates.length > 0 && (
          <div className="flex gap-4 mb-5">
            <button
              onClick={() => setMode("existing")}
              className={clsx(
                "text-sm font-medium pb-1 border-b-2 transition-colors",
                mode === "existing"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              Use existing template
            </button>
            <button
              onClick={() => setMode("new")}
              className={clsx(
                "text-sm font-medium pb-1 border-b-2 transition-colors",
                mode === "new"
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              Request by credential type
            </button>
          </div>
        )}

        {mode === "existing" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Presentation template
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              {existingTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Credential type URI
              </label>
              <input
                type="text"
                value={credentialType}
                onChange={(e) => setCredentialType(e.target.value)}
                placeholder="https://metadata.paradym.id/types/web-dev-completion-v1"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <p className="text-xs text-gray-400 mt-1">
                Get this URI from the issuing partner&apos;s credential template.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Request name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Web Development Verification"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={createRequest}
        disabled={submitting || (mode === "existing" ? !templateId : !credentialType)}
        className="bg-gray-900 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Generating QR…" : "Generate verification QR →"}
      </button>
    </div>
  );
}
