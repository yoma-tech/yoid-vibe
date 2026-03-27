import { listCredentialTemplates } from "@/lib/yoid";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  let templates: Awaited<ReturnType<typeof listCredentialTemplates>> = [];
  let error: string | null = null;

  try {
    templates = await listCredentialTemplates();
  } catch (err) {
    error = String(err);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Credential Templates</h2>
          <p className="text-sm text-gray-500 mt-1">
            Templates define the structure of credentials you issue.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/issuer/presets"
            className="text-sm border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Browse presets
          </Link>
          <Link
            href="/issuer/templates/new"
            className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            + New template
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          Could not load templates: {error}
        </div>
      )}

      {templates.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center text-gray-400">
          <div className="text-3xl mb-2">📝</div>
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">
            <Link href="/issuer/presets" className="text-gray-600 underline">
              Start from a preset
            </Link>{" "}
            or{" "}
            <Link href="/issuer/templates/new" className="text-gray-600 underline">
              create from scratch
            </Link>
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  {t.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>
                  )}
                  {t.type && (
                    <p className="text-xs text-gray-400 mt-1 font-mono break-all">
                      {t.type}
                    </p>
                  )}
                </div>
                <Link
                  href={`/issuer/issue?templateId=${t.id}`}
                  className="shrink-0 text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Issue credential →
                </Link>
              </div>
              {t.attributes && Object.keys(t.attributes).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(t.attributes).map(([key, attr]) => (
                    <span
                      key={key}
                      className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded"
                    >
                      {key} ({attr.type})
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 text-xs text-gray-400">
                Created {new Date(t.createdAt).toISOString().slice(0, 10)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
