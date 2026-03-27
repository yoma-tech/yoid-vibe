"use client";

import { useState, useTransition } from "react";
import type { TalentProfile } from "@/lib/db";
import clsx from "clsx";

export function TalentPoolSearch({
  initialProfiles,
}: {
  initialProfiles: TalentProfile[];
}) {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState(initialProfiles);
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function search(q: string) {
    setQuery(q);
    startTransition(async () => {
      const res = await fetch(`/api/verifier/talent?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { profiles: TalentProfile[] };
      setProfiles(data.profiles);
    });
  }

  const selectedProfile = profiles.find((p) => p.id === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: search + list */}
      <div className="lg:col-span-2">
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder="Search by name, skill, or credential type…"
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        {profiles.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-gray-400">
            <div className="text-3xl mb-2">👥</div>
            {query ? (
              <>
                <p className="font-medium">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-sm mt-1">Try a different skill or name.</p>
              </>
            ) : (
              <>
                <p className="font-medium">Talent pool is empty</p>
                <p className="text-sm mt-1">
                  Youth join by scanning a verification QR in the{" "}
                  <a href="/verifier/verify" className="text-gray-600 underline">
                    Verify tab
                  </a>
                  .
                </p>
              </>
            )}
          </div>
        ) : (
          <div className={clsx("space-y-3", isPending && "opacity-60 pointer-events-none")}>
            {profiles.map((profile) => (
              <div
                key={profile.id}
                onClick={() => setSelected(selected === profile.id ? null : profile.id)}
                className={clsx(
                  "bg-white rounded-xl border-2 p-4 cursor-pointer transition-all",
                  selected === profile.id
                    ? "border-gray-900"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-gray-900">
                      {profile.firstName} {profile.lastName}
                    </span>
                    {profile.email && (
                      <span className="ml-2 text-sm text-gray-400">{profile.email}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {profile.credentials.length} credential
                    {profile.credentials.length !== 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {profile.credentials.map((c) => (
                    <span
                      key={c.id}
                      className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"
                    >
                      {c.credentialName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: profile detail */}
      <div>
        {selectedProfile ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-20">
            <div className="mb-4">
              <h3 className="font-bold text-gray-900 text-lg">
                {selectedProfile.firstName} {selectedProfile.lastName}
              </h3>
              {selectedProfile.email && (
                <p className="text-sm text-gray-400">{selectedProfile.email}</p>
              )}
            </div>

            <div className="space-y-4">
              {selectedProfile.credentials.map((cred) => (
                <div key={cred.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-800">
                      {cred.credentialName}
                    </span>
                    <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded">
                      verified
                    </span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(cred.attributes).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-gray-400">{k}</span>
                        <span className="text-gray-700 font-medium">{v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-300">
                    Verified {cred.verifiedAt.slice(0, 10)}
                  </div>
                </div>
              ))}
            </div>

            <a
              href="/verifier/verify"
              className="mt-4 block w-full text-center text-sm bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Request fresh verification →
            </a>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400 sticky top-20">
            Select a profile to view their verified credentials
          </div>
        )}
      </div>
    </div>
  );
}
