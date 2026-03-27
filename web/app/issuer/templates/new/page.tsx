import { NewTemplateForm } from "./NewTemplateForm";

type AttrDef = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  alwaysDisclosed: boolean;
};

export default async function NewTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{
    presetId?: string;
    presetName?: string;
    presetDescription?: string;
    presetType?: string;
    presetAttributes?: string;
  }>;
}) {
  const params = await searchParams;

  let presetName: string | undefined;
  let presetDescription: string | undefined;
  let presetType: string | undefined;
  let presetAttributes: Record<string, AttrDef> | undefined;

  if (params.presetId && params.presetAttributes) {
    presetName = params.presetName;
    presetDescription = params.presetDescription;
    presetType = params.presetType;
    try {
      presetAttributes = JSON.parse(params.presetAttributes) as Record<string, AttrDef>;
    } catch {
      // ignore malformed
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {presetName ? `New Template from "${presetName}"` : "New Credential Template"}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {presetName
            ? "Review and customise the attributes before creating your template."
            : "Define the structure of credentials you'll issue."}
        </p>
      </div>
      <NewTemplateForm
        presetName={presetName}
        presetDescription={presetDescription}
        presetType={presetType}
        presetAttributes={presetAttributes}
      />
    </div>
  );
}
