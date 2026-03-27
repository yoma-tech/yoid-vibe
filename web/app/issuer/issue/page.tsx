import { listCredentialTemplates } from "@/lib/yoid";
import { IssueForm } from "./IssueForm";

export const dynamic = "force-dynamic";

export default async function IssuePage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const { templateId } = await searchParams;

  let templates: Awaited<ReturnType<typeof listCredentialTemplates>> = [];
  let error: string | null = null;

  try {
    templates = await listCredentialTemplates();
  } catch (err) {
    error = String(err);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Issue a Credential</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select a template, fill in the youth&apos;s details, and send a credential offer.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          Could not load templates: {error}
        </div>
      ) : (
        <IssueForm templates={templates} defaultTemplateId={templateId} />
      )}
    </div>
  );
}
