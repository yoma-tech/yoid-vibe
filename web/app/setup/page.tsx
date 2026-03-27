"use client";

import { useState } from "react";

export default function SetupPage() {
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [endpoints, setEndpoints] = useState<{ id: string; url: string }[] | null>(null);

  async function registerWebhook() {
    setRegistering(true);
    setWebhookStatus(null);
    try {
      const res = await fetch("/api/setup/webhook", { method: "POST" });
      const data = await res.json() as { endpoint?: { id: string; url: string }; error?: string };
      if (!res.ok) throw new Error(data.error);
      setWebhookStatus(`Registered: ${data.endpoint?.url}`);
    } catch (err) {
      setWebhookStatus(`Error: ${String(err)}`);
    } finally {
      setRegistering(false);
    }
  }

  async function checkEndpoints() {
    try {
      const res = await fetch("/api/setup/webhook");
      const data = await res.json() as { endpoints: { id: string; url: string }[] };
      setEndpoints(data.endpoints);
    } catch (err) {
      setEndpoints([]);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Setup</h1>
      <p className="text-sm text-gray-500 mb-8">
        One-time configuration for the YoID demo.
      </p>

      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">1. API Credentials</h2>
          <p className="text-sm text-gray-500 mb-3">
            Add your YoID client credentials to{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env.local</code>.
          </p>
          <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 overflow-auto">
{`YOID_CLIENT_ID=your_client_id
YOID_CLIENT_SECRET=your_client_secret`}
          </pre>
          <p className="text-xs text-gray-400 mt-2">
            Restart the dev server after updating env vars.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">2. Webhook Registration</h2>
          <p className="text-sm text-gray-500 mb-3">
            For local development, use ngrok to expose your server, then set{" "}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">WEBHOOK_BASE_URL</code>{" "}
            in <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">.env.local</code>.
          </p>
          <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 mb-4">
{`# In a separate terminal:
ngrok http 3000

# Then update .env.local:
WEBHOOK_BASE_URL=https://abc123.ngrok.io`}
          </pre>
          <div className="flex gap-3 items-center">
            <button
              onClick={registerWebhook}
              disabled={registering}
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {registering ? "Registering…" : "Register webhook"}
            </button>
            <button
              onClick={checkEndpoints}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Check existing
            </button>
          </div>
          {webhookStatus && (
            <p className={`text-sm mt-3 ${webhookStatus.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {webhookStatus}
            </p>
          )}
          {endpoints !== null && (
            <div className="mt-3">
              {endpoints.length === 0 ? (
                <p className="text-sm text-gray-400">No webhook endpoints registered.</p>
              ) : (
                <div className="space-y-1">
                  {endpoints.map((ep) => (
                    <div key={ep.id} className="text-xs font-mono text-gray-600 bg-gray-50 px-3 py-1.5 rounded">
                      {ep.url}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-3">3. Flow overview</h2>
          <ol className="space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="text-gray-300 font-mono">1.</span>
              <span><strong>Issuer</strong> browses presets → creates a credential template → issues credentials to youth via QR</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-300 font-mono">2.</span>
              <span><strong>Youth</strong> scans QR with DIDx:Me wallet → accepts credential</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-300 font-mono">3.</span>
              <span><strong>Verifier</strong> generates a verification QR → youth scans and selectively shares credentials</span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-300 font-mono">4.</span>
              <span>Verified data is indexed into the <strong>Talent Pool</strong> — verifiers can search and browse</span>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
