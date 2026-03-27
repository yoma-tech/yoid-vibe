"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { EcosystemPreset } from "@/lib/yoid";
import clsx from "clsx";

// Map author codes to readable org names
const AUTHOR_LABELS: Record<string, string> = {
  eco: "ECO",
  sarb: "SARB",
  contactable: "Contactable",
  iyam: "IYAM",
  "partner-org-1": "Partner Org",
};

export function LivePresetGrid({ presets }: { presets: EcosystemPreset[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeAuthor, setActiveAuthor] = useState<string | null>(null);
  const router = useRouter();

  const authors = [...new Set(presets.map((p) => p.author))].sort();
  const filtered = activeAuthor
    ? presets.filter((p) => p.author === activeAuthor)
    : presets;

  function handleUsePreset(preset: EcosystemPreset) {
    // Encode the preset as query params for the new template form
    const params = new URLSearchParams({
      presetId: preset.id,
      presetName: preset.templateName,
      presetDescription: preset.templateDescription,
      presetType: preset.templateType,
      presetAttributes: JSON.stringify(preset.templateAttributes),
    });
    router.push(`/issuer/templates/new?${params.toString()}`);
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <button
          onClick={() => setActiveAuthor(null)}
          className={clsx(
            "px-3 py-1 rounded-full text-sm transition-colors",
            activeAuthor === null
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          All ({presets.length})
        </button>
        {authors.map((author) => {
          const count = presets.filter((p) => p.author === author).length;
          return (
            <button
              key={author}
              onClick={() => setActiveAuthor(author)}
              className={clsx(
                "px-3 py-1 rounded-full text-sm transition-colors",
                activeAuthor === author
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {AUTHOR_LABELS[author] ?? author} ({count})
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((preset) => (
          <div
            key={preset.id}
            onClick={() => setSelected(selected === preset.id ? null : preset.id)}
            className={clsx(
              "bg-white rounded-xl border-2 p-5 cursor-pointer transition-all",
              selected === preset.id
                ? "border-gray-900 shadow-sm"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">
                {AUTHOR_LABELS[preset.author] ?? preset.author}
              </span>
              <span className="text-xs text-gray-400">
                {Object.keys(preset.templateAttributes).length} attrs
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{preset.templateName}</h3>
            {preset.templateDescription && (
              <p className="text-sm text-gray-500 mb-2">{preset.templateDescription}</p>
            )}
            <p className="text-xs text-gray-300 font-mono truncate">{preset.templateType}</p>

            {selected === preset.id && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <div className="mb-3 space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(preset.templateAttributes).map(([key, attr]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{attr.name ?? key}</span>
                      <span
                        className={clsx(
                          "px-1.5 py-0.5 rounded",
                          attr.alwaysDisclosed
                            ? "bg-green-50 text-green-600"
                            : "bg-gray-50 text-gray-400"
                        )}
                      >
                        {attr.alwaysDisclosed ? "always shown" : "selective"}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUsePreset(preset);
                  }}
                  className="w-full bg-gray-900 text-white text-sm py-2 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Use this preset →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
