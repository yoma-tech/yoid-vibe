"use client";

import { useState } from "react";
import type { IssuanceRow } from "@/lib/db";
import clsx from "clsx";
import { QRCodeImage } from "@/components/QRCodeImage";

const STATUS_STYLES: Record<string, string> = {
  offered: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  expired: "bg-gray-100 text-gray-500",
  revoked: "bg-orange-50 text-orange-700",
};

export function IssuanceDashboard({
  initialIssuances,
}: {
  initialIssuances: IssuanceRow[];
}) {
  const [issuances, setIssuances] = useState(initialIssuances);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [showQr, setShowQr] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  async function handleRevoke(id: string) {
    setRevoking(id);
    setConfirmRevoke(null);
    setRevokeError(null);
    try {
      const res = await fetch(`/api/issuer/revoke/${id}`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Revoke failed");
      setIssuances((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "revoked" } : i))
      );
    } catch (err) {
      setRevokeError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevoking(null);
    }
  }

  const stats = {
    total: issuances.length,
    offered: issuances.filter((i) => i.status === "offered").length,
    completed: issuances.filter((i) => i.status === "completed").length,
    revoked: issuances.filter((i) => i.status === "revoked").length,
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Issued", value: stats.total, color: "text-gray-900" },
          { label: "Pending Acceptance", value: stats.offered, color: "text-blue-600" },
          { label: "Accepted", value: stats.completed, color: "text-green-600" },
          { label: "Revoked", value: stats.revoked, color: "text-orange-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Issued Credentials</h2>
          <a
            href="/issuer/issue"
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Issue New
          </a>
        </div>

        {issuances.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            <div className="text-3xl mb-2">📋</div>
            <p className="font-medium">No credentials issued yet</p>
            <p className="text-sm mt-1">
              <a href="/issuer/issue" className="text-gray-600 underline">
                Issue your first credential
              </a>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {issuances.map((issuance) => (
              <div key={issuance.id} className="px-6 py-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 text-sm">
                      {issuance.credentialTemplateName ?? "Unknown Template"}
                    </span>
                    <span
                      className={clsx(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        STATUS_STYLES[issuance.status] ?? "bg-gray-100 text-gray-500"
                      )}
                    >
                      {issuance.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {issuance.holderEmail && (
                      <span className="mr-3">{issuance.holderEmail}</span>
                    )}
                    <span>{issuance.createdAt.slice(0, 10)}</span>
                  </div>
                  {Object.keys(issuance.claims).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(issuance.claims)
                        .slice(0, 3)
                        .map(([k, v]) => (
                          <span
                            key={k}
                            className="text-xs bg-gray-50 text-gray-600 px-2 py-0.5 rounded"
                          >
                            {k}: {v}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {issuance.offerQrUri && issuance.status === "offered" && (
                    <button
                      onClick={() =>
                        setShowQr(showQr === issuance.id ? null : issuance.id)
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {showQr === issuance.id ? "Hide QR" : "Show QR"}
                    </button>
                  )}
                  {issuance.status !== "revoked" &&
                    issuance.status !== "expired" && (
                      <button
                        onClick={() => setConfirmRevoke(issuance.id)}
                        disabled={revoking === issuance.id}
                        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                      >
                        {revoking === issuance.id ? "Revoking…" : "Revoke"}
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revoke confirmation modal */}
      {confirmRevoke && (() => {
        const issuance = issuances.find((i) => i.id === confirmRevoke);
        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setConfirmRevoke(null)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Revoke credential</h3>
                  <p className="text-sm text-gray-500">{issuance?.credentialTemplateName}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-5">
                This will permanently revoke the credential. The holder will no longer be able to present it. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleRevoke(confirmRevoke)}
                  className="flex-1 bg-red-600 text-white text-sm py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Revoke credential
                </button>
                <button
                  onClick={() => setConfirmRevoke(null)}
                  className="flex-1 border border-gray-200 text-sm py-2 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Revoke error toast */}
      {revokeError && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 max-w-sm">
          <span className="flex-1">{revokeError}</span>
          <button onClick={() => setRevokeError(null)} className="shrink-0 text-red-200 hover:text-white">✕</button>
        </div>
      )}

      {/* QR overlay */}
      {showQr && (() => {
        const issuance = issuances.find((i) => i.id === showQr);
        if (!issuance?.offerQrUri) return null;
        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowQr(null)}
          >
            <div
              className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold text-gray-900 mb-1">
                {issuance.credentialTemplateName}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Youth scans this with their DIDx:Me wallet to accept the credential.
              </p>
              <QRCodeImage data={issuance.offerQrUri} size={250} className="w-full rounded-lg" alt="QR code" />
              <a
                href={issuance.offerUri}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 block text-center text-sm text-blue-600 hover:underline"
              >
                Open link directly →
              </a>
              <button
                onClick={() => setShowQr(null)}
                className="mt-3 w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
