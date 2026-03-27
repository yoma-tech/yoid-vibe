import { getAllTalentProfiles } from "@/lib/db";
import { TalentPoolSearch } from "./TalentPoolSearch";

export const dynamic = "force-dynamic";

export default function VerifierPage() {
  const profiles = getAllTalentProfiles();
  return <TalentPoolSearch initialProfiles={profiles} />;
}
