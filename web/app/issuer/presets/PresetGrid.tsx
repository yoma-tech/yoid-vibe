"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Preset } from "@/lib/presets";
import clsx from "clsx";

export function PresetGrid({
  presets,
  categories,
}: {
  presets: Preset[];
  categories: string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const router = useRouter();

  const filtered = activeCategory
    ? presets.filter((p) => p.category === activeCategory)
    : presets;

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setActiveCategory(null)}
          className={clsx(
            "px-3 py-1 rounded-full text-sm transition-colors",
            activeCategory === null
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              "px-3 py-1 rounded-full text-sm transition-colors",
              activeCategory === cat
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {cat}
          </button>
        ))}
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
              <span className="text-2xl">{preset.icon}</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {preset.category}
              </span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{preset.name}</h3>
            <p className="text-sm text-gray-500 mb-3">{preset.description}</p>

            <div className="text-xs text-gray-400 mb-3">
              {Object.keys(preset.attributes).length} attributes
            </div>

            {selected === preset.id && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="mb-3 space-y-1">
                  {Object.entries(preset.attributes).map(([key, attr]) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">{attr.label}</span>
                      <span className={clsx(
                        "px-1.5 py-0.5 rounded",
                        attr.alwaysDisclosed
                          ? "bg-green-50 text-green-600"
                          : "bg-gray-50 text-gray-400"
                      )}>
                        {attr.alwaysDisclosed ? "always shown" : "selective"}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/issuer/templates/new?preset=${preset.id}`);
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
