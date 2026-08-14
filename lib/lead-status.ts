export const STATUS_LABEL: Record<string, string> = {
  nye: "Nye",
  under_arbeid: "Under arbeid",
  oppfolging: "For oppfølging",
  vunnet: "Kunde vunnet",
  levert: "Bil levert",
  ferdig: "Ferdig",
  tapt: "Tapt",
};

export const STATUS_COLOR: Record<string, string> = {
  nye: "#5b8fc7",
  under_arbeid: "#e0a03b",
  oppfolging: "#a06fd1",
  vunnet: "#1c9c5b",
  levert: "#1c9c5b",
  ferdig: "#888",
  tapt: "#d9534f",
};

export const INACTIVE_DAYS = 4;
export const CONTACT_SLA_HOURS = 4;
export const HANDLING_SLA_MIN = 60;

export type SlaLevel = "green" | "yellow" | "red" | null;

export function contactSlaLevel(lead: any): SlaLevel {
  if (!["nye", "under_arbeid"].includes(lead.status)) return null;
  const deadline = new Date(lead.created_at).getTime() + CONTACT_SLA_HOURS * 60 * 60 * 1000;
  const remainMin = (deadline - Date.now()) / 60000;
  if (remainMin <= 0) return "red";
  if (remainMin <= 60) return "yellow";
  return "green";
}

export function handlingSlaLevel(lead: any): SlaLevel {
  if (lead.status !== "under_arbeid" || !lead.accepted_at) return null;
  const deadline = new Date(lead.accepted_at).getTime() + HANDLING_SLA_MIN * 60 * 1000;
  const remainMin = (deadline - Date.now()) / 60000;
  if (remainMin <= 0) return "red";
  if (remainMin <= 15) return "yellow";
  return "green";
}

export function isOldLead(lead: any): boolean {
  if (["ferdig", "tapt", "nye"].includes(lead.status)) return false;
  const ageDays = (Date.now() - new Date(lead.last_activity_at).getTime()) / 1000 / 60 / 60 / 24;
  return ageDays > INACTIVE_DAYS;
}

export function needsAttention(lead: any): boolean {
  return contactSlaLevel(lead) === "red" || handlingSlaLevel(lead) === "red" || isOldLead(lead);
}
