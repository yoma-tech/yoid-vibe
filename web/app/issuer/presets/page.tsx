import { listEcosystemPresets } from "@/lib/yoid";
import { LivePresetGrid } from "./LivePresetGrid";

export const dynamic = "force-dynamic";

const EXCLUDED_AUTHORS = new Set(["didxyz"]);

export default async function PresetsPage() {
  let presets: Awaited<ReturnType<typeof listEcosystemPresets>> = [];
  let error: string | null = null;

  try {
    const all = await listEcosystemPresets();
    // Filter out test/postman entries (identifiable by "postman-" in the id code)
    const seen = new Set<string>();
    presets = all.filter((p) => {
      if (EXCLUDED_AUTHORS.has(p.author)) return false;
      if (p.id.includes("postman-")) return false;
      // Deduplicate by author+templateName
      const key = `${p.author}:${p.templateName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch (err) {
    error = String(err);
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Ecosystem Presets</h2>
        <p className="text-sm text-gray-500 mt-1">
          Live credential templates from the YoID ecosystem. Select one to create your own template from it.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <LivePresetGrid presets={presets} />
      )}
    </div>
  );
}
