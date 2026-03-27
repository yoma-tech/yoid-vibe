import { getIssuances, updateIssuanceStatus, updateIssuanceCredentialId } from "@/lib/db";
import { listIssuances } from "@/lib/yoid";
import { IssuanceDashboard } from "./IssuanceDashboard";

export const dynamic = "force-dynamic";

export default async function IssuerPage() {
  // Sync statuses and backfill credentialId from the API on every page load
  try {
    const local = getIssuances();
    const needsSync = local.filter(
      (i) => i.status === "offered" || !i.credentialId
    );
    if (needsSync.length > 0) {
      const apiRecords = await listIssuances();
      for (const apiRecord of apiRecords) {
        const localMatch = needsSync.find((i) => i.id === apiRecord.id);
        if (localMatch) {
          if (apiRecord.status !== "offered" && localMatch.status === "offered") {
            updateIssuanceStatus(apiRecord.id, apiRecord.status);
          }
          // Backfill the inner credential ID if we don't have it yet
          const innerCredId = apiRecord.credentials?.[0]?.id;
          if (innerCredId && !localMatch.credentialId) {
            updateIssuanceCredentialId(apiRecord.id, innerCredId);
          }
        }
      }
    }
  } catch {
    // Non-fatal — show whatever is in the DB
  }

  const issuances = getIssuances();
  return <IssuanceDashboard initialIssuances={issuances} />;
}
