export const ONBOARDING_STAGES = [
  { stage: 1, name: "Registration", description: "Company and contact details captured" },
  { stage: 2, name: "Invoice", description: "Membership invoice issued" },
  { stage: 3, name: "WhatsApp", description: "Member added to the relevant WhatsApp group" },
  { stage: 4, name: "Certificate", description: "Membership certificate prepared and issued" },
  { stage: 5, name: "Database", description: "Member added to the official membership database" },
  { stage: 6, name: "Completion", description: "All onboarding activities completed" },
] as const;

export const TOTAL_STAGES = ONBOARDING_STAGES.length;