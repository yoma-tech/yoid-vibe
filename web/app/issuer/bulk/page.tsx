import BulkUploader from "./BulkUploader";

export default function BulkImportPage() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Bulk Import</h2>
        <p className="text-sm text-gray-500 mt-1">
          Drop a CSV, XLSX, or JSON file. Claude will read the data, match or create a credential template, and issue credentials for every row.
        </p>
      </div>
      <BulkUploader />
    </div>
  );
}
