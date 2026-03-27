import { listPresentationTemplates } from "@/lib/yoid";
import { VerifyFlow } from "./VerifyFlow";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  let templates: Awaited<ReturnType<typeof listPresentationTemplates>> = [];
  let error: string | null = null;

  try {
    templates = await listPresentationTemplates();
  } catch (err) {
    error = String(err);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Request Credential Verification</h2>
        <p className="text-sm text-gray-500 mt-1">
          Generate a QR code for a youth to scan and present their credentials.
          Verified data is automatically added to the talent pool.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          Could not load presentation templates: {error}
        </div>
      )}

      <VerifyFlow existingTemplates={templates} />
    </div>
  );
}
