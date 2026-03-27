"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";

type AttrDef = { type: string; alwaysDisclosed: boolean };
type LiveAttrDef = { name: string; type: string; required: boolean; description: string; alwaysDisclosed: boolean };

export function NewTemplateForm({
  presetName,
  presetDescription,
  presetType,
  presetAttributes,
}: {
  presetName?: string;
  presetDescription?: string;
  presetType?: string;
  presetAttributes?: Record<string, LiveAttrDef>;
}) {
  const router = useRouter();

  const [name, setName] = useState(presetName ?? "");
  const [description, setDescription] = useState(presetDescription ?? "");
  const [attributes, setAttributes] = useState<Record<string, AttrDef>>(() => {
    if (!presetAttributes) return { fullName: { type: "string", alwaysDisclosed: true } };
    return Object.fromEntries(
      Object.entries(presetAttributes).map(([k, v]) => [
        k,
        { type: v.type ?? "string", alwaysDisclosed: v.alwaysDisclosed ?? false },
      ])
    );
  });

  const [newAttrKey, setNewAttrKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addAttribute() {
    const key = newAttrKey.trim();
    if (!key || attributes[key]) return;
    setAttributes((prev) => ({
      ...prev,
      [key]: { type: "string", alwaysDisclosed: false },
    }));
    setNewAttrKey("");
  }

  function removeAttribute(key: string) {
    setAttributes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        name,
        description,
        attributes: Object.fromEntries(
          Object.entries(attributes).map(([k, v]) => [
            k,
            { type: v.type, alwaysDisclosed: v.alwaysDisclosed },
          ])
        ),
      };
      // API requires either 'type' (full URI from preset) or 'code' (simple slug)
      if (presetType) {
        body.type = presetType;
      } else {
        body.code = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      }

      const res = await fetch("/api/issuer/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error: string };
        throw new Error(data.error);
      }

      router.push("/issuer/templates");
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
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
            Template name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            placeholder="Web Development Completion"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
            placeholder="Issued to youth who complete the programme…"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-medium text-gray-900 mb-4">Attributes</h3>

        <div className="space-y-2 mb-4">
          {Object.entries(attributes).map(([key, attr]) => (
            <div
              key={key}
              className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"
            >
              <span className="text-sm font-mono text-gray-700 flex-1">{key}</span>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attr.alwaysDisclosed}
                  onChange={(e) =>
                    setAttributes((prev) => ({
                      ...prev,
                      [key]: { ...prev[key], alwaysDisclosed: e.target.checked },
                    }))
                  }
                  className="rounded"
                />
                Always disclosed
              </label>
              <button
                type="button"
                onClick={() => removeAttribute(key)}
                className="text-gray-300 hover:text-red-400 transition-colors text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newAttrKey}
            onChange={(e) => setNewAttrKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addAttribute())}
            placeholder="attributeName (camelCase)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
          <button
            type="button"
            onClick={addAttribute}
            className="text-sm border border-gray-300 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          "Always disclosed" attributes are always shared with verifiers. Others can be
          selectively disclosed by the youth.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="bg-gray-900 text-white text-sm px-6 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Creating…" : "Create template"}
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
