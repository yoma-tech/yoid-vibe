/**
 * Ecosystem credential presets — curated templates for common credential types
 * in the YOMA / YoID ecosystem. These serve as starting points for issuers.
 */

export type Preset = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  attributes: Record<
    string,
    { type: string; label: string; alwaysDisclosed?: boolean; example: string }
  >;
};

export const PRESETS: Preset[] = [
  {
    id: "web-dev-completion",
    name: "Web Development Completion",
    description:
      "Issued to youth who complete a web development programme. Covers front-end, back-end, and project-based skills.",
    category: "Digital Skills",
    icon: "💻",
    attributes: {
      fullName: { type: "string", label: "Full Name", alwaysDisclosed: true, example: "Amara Okafor" },
      programmeName: { type: "string", label: "Programme Name", alwaysDisclosed: true, example: "Umuzi Web Development" },
      completionDate: { type: "string", label: "Completion Date", alwaysDisclosed: true, example: "2025-03-15" },
      issuerName: { type: "string", label: "Issuing Organisation", alwaysDisclosed: true, example: "Umuzi" },
      skillsCovered: { type: "string", label: "Skills Covered", alwaysDisclosed: false, example: "HTML, CSS, JavaScript, React, Node.js" },
      assessmentScore: { type: "string", label: "Assessment Score", alwaysDisclosed: false, example: "87%" },
    },
  },
  {
    id: "financial-literacy",
    name: "Financial Literacy",
    description:
      "Certifies completion of a financial literacy module covering budgeting, saving, and basic investment principles.",
    category: "Life Skills",
    icon: "💰",
    attributes: {
      fullName: { type: "string", label: "Full Name", alwaysDisclosed: true, example: "Thandi Dlamini" },
      moduleName: { type: "string", label: "Module Name", alwaysDisclosed: true, example: "Money Foundations" },
      completionDate: { type: "string", label: "Completion Date", alwaysDisclosed: true, example: "2025-01-20" },
      issuerName: { type: "string", label: "Issuing Organisation", alwaysDisclosed: true, example: "JA Worldwide" },
      topicsCompleted: { type: "string", label: "Topics Completed", alwaysDisclosed: false, example: "Budgeting, Saving, Credit, Investment Basics" },
    },
  },
  {
    id: "funrun-participation",
    name: "FunRun Participation",
    description:
      "Recognises youth participation in community health and fitness events run through the YOMA ecosystem.",
    category: "Health & Wellness",
    icon: "🏃",
    attributes: {
      fullName: { type: "string", label: "Full Name", alwaysDisclosed: true, example: "Kwame Mensah" },
      eventName: { type: "string", label: "Event Name", alwaysDisclosed: true, example: "Joburg FunRun 2025" },
      eventDate: { type: "string", label: "Event Date", alwaysDisclosed: true, example: "2025-04-12" },
      distance: { type: "string", label: "Distance Completed", alwaysDisclosed: false, example: "5km" },
      issuerName: { type: "string", label: "Issuing Organisation", alwaysDisclosed: true, example: "YOMA Health" },
    },
  },
  {
    id: "entrepreneurship",
    name: "Entrepreneurship Programme",
    description:
      "Awarded on completion of a youth entrepreneurship programme covering business planning, pitching, and market basics.",
    category: "Business",
    icon: "🚀",
    attributes: {
      fullName: { type: "string", label: "Full Name", alwaysDisclosed: true, example: "Fatima Al-Hassan" },
      programmeName: { type: "string", label: "Programme Name", alwaysDisclosed: true, example: "StartUp Launchpad" },
      completionDate: { type: "string", label: "Completion Date", alwaysDisclosed: true, example: "2025-02-28" },
      issuerName: { type: "string", label: "Issuing Organisation", alwaysDisclosed: true, example: "IXO Foundation" },
      businessConceptTitle: { type: "string", label: "Business Concept", alwaysDisclosed: false, example: "EcoPackaging SA" },
    },
  },
  {
    id: "agricultural-training",
    name: "Agricultural Training",
    description:
      "Certifies practical agricultural training for youth in farming, food security, and sustainable land use.",
    category: "Agriculture",
    icon: "🌱",
    attributes: {
      fullName: { type: "string", label: "Full Name", alwaysDisclosed: true, example: "Sipho Nkosi" },
      trainingName: { type: "string", label: "Training Programme", alwaysDisclosed: true, example: "AgriStart Youth Programme" },
      completionDate: { type: "string", label: "Completion Date", alwaysDisclosed: true, example: "2025-05-10" },
      issuerName: { type: "string", label: "Issuing Organisation", alwaysDisclosed: true, example: "AgriSETA" },
      cropSpecialisation: { type: "string", label: "Specialisation", alwaysDisclosed: false, example: "Vegetable Farming" },
    },
  },
  {
    id: "volunteering",
    name: "Volunteering & Community Service",
    description:
      "Recognises youth contribution through volunteering and community service activities.",
    category: "Community",
    icon: "🤝",
    attributes: {
      fullName: { type: "string", label: "Full Name", alwaysDisclosed: true, example: "Nomsa Zulu" },
      organisationName: { type: "string", label: "Organisation", alwaysDisclosed: true, example: "Harambee Youth Employment Accelerator" },
      role: { type: "string", label: "Role", alwaysDisclosed: true, example: "Youth Mentor" },
      hoursCompleted: { type: "string", label: "Hours Completed", alwaysDisclosed: false, example: "120" },
      periodStart: { type: "string", label: "Period Start", alwaysDisclosed: false, example: "2025-01-01" },
      periodEnd: { type: "string", label: "Period End", alwaysDisclosed: false, example: "2025-06-30" },
      issuerName: { type: "string", label: "Issuing Organisation", alwaysDisclosed: true, example: "Harambee" },
    },
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export const CATEGORIES = [...new Set(PRESETS.map((p) => p.category))];
