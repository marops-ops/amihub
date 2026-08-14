"use server";

import { createServerSupabase } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

async function getUser(supabase: Awaited<ReturnType<typeof createServerSupabase>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function touch() {
  return new Date().toISOString();
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  leadId: string,
  userId: string | null,
  activityType: string,
  newValue: Record<string, unknown>,
  note?: string
) {
  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    user_id: userId,
    activity_type: activityType,
    new_value: newValue,
    note,
  });
}

/**
 * First seller to accept a 'nye' lead becomes owner. Atomic: the
 * status='nye' filter means a second, near-simultaneous accept affects
 * zero rows instead of overwriting the first seller's claim.
 */
export async function acceptLead(leadId: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const { data, error } = await supabase
    .from("leads")
    .update({ status: "under_arbeid", assigned_to: user.id, accepted_at: now, last_activity_at: now })
    .eq("id", leadId)
    .eq("status", "nye")
    .select()
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) return { error: "Lead er allerede akseptert av noen andre" };

  await logActivity(supabase, leadId, user.id, "accepted", { assigned_to: user.id });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

const IKKE_AKTUELT_REASONS = [
  "Ingen kontakt",
  "Feil kontaktinformasjon",
  "Konkurrent",
  "Ikke finansiering",
  "Kun informasjon",
  "Annet",
] as const;

const KUNDE_AVSLATT_REASONS = [
  "Pris",
  "Leveringstid",
  "Valgte annet merke",
  "Finansiering",
  "Ombestemte seg",
  "Ingen respons",
  "Annet",
] as const;

export { IKKE_AKTUELT_REASONS, KUNDE_AVSLATT_REASONS };

export async function setIkkeAktuelt(leadId: string, reason: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const { error } = await supabase
    .from("leads")
    .update({ status: "tapt", lost_type: "ikke_aktuelt", lost_reason: reason, last_activity_at: now })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, user.id, "status_changed", {
    status: "tapt",
    lost_type: "ikke_aktuelt",
    lost_reason: reason,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

async function moveToOppfolging(leadId: string, userId: string, activityNote: string) {
  const supabase = await createServerSupabase();
  const now = touch();
  const nextReminder = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("leads")
    .update({
      status: "oppfolging",
      sub_status: "kunde_avventer",
      next_reminder_at: nextReminder,
      last_activity_at: now,
    })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, userId, "status_changed", {
    status: "oppfolging",
    sub_status: "kunde_avventer",
    next_reminder_at: nextReminder,
  }, activityNote);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function setTilbudGitt(leadId: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };
  return moveToOppfolging(leadId, user.id, "Tilbud gitt — automatisk oppfølging planlagt om 3 dager");
}

export async function setProvekjoringBooket(leadId: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };
  return moveToOppfolging(leadId, user.id, "Prøvekjøring booket — automatisk oppfølging planlagt om 3 dager");
}

export async function resetKundeAvventer(leadId: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const nextReminder = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("leads")
    .update({ next_reminder_at: nextReminder, last_activity_at: now })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, user.id, "sub_status_changed", {
    next_reminder_at: nextReminder,
  }, "Varsel-syklus nullstilt manuelt");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function setKundeAvslattTilbud(leadId: string, reason: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const { error } = await supabase
    .from("leads")
    .update({ status: "tapt", lost_type: "kunde_avslatt_tilbud", lost_reason: reason, last_activity_at: now })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, user.id, "status_changed", {
    status: "tapt",
    lost_type: "kunde_avslatt_tilbud",
    lost_reason: reason,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function setKontraktSkrevet(leadId: string, deliveryDateIso: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const { error } = await supabase
    .from("leads")
    .update({
      status: "vunnet",
      delivery_date: deliveryDateIso,
      delivery_reminder_sent: false,
      last_activity_at: now,
    })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, user.id, "delivery_date_set", {
    status: "vunnet",
    delivery_date: deliveryDateIso,
  });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function setNyUtleveringsdato(leadId: string, deliveryDateIso: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const { error } = await supabase
    .from("leads")
    .update({ delivery_date: deliveryDateIso, delivery_reminder_sent: false, last_activity_at: now })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, user.id, "delivery_date_set", {
    delivery_date: deliveryDateIso,
  }, "Ny utleveringsdato satt — alle varsler flyttet automatisk");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function markLevert(leadId: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const { error } = await supabase
    .from("leads")
    .update({ status: "levert", delivered_at: now, call_reminder_sent: false, last_activity_at: now })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, user.id, "delivery_confirmed", { status: "levert" });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function registrerOppfolgingssamtale(leadId: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const { error } = await supabase
    .from("leads")
    .update({ status: "ferdig", last_activity_at: now })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, user.id, "follow_up_call_registered", { status: "ferdig" });
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function addNote(leadId: string, note: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };
  if (!note.trim()) return { error: "Notat kan ikke være tomt" };

  const { error: noteError } = await supabase.from("lead_notes").insert({
    lead_id: leadId,
    user_id: user.id,
    note,
  });
  if (noteError) return { error: noteError.message };

  await supabase.from("leads").update({ last_activity_at: touch() }).eq("id", leadId);
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

/**
 * Salgsleder reassigns a lead to a different seller (ferie, sykdom,
 * feilfordeling, endret ansvarsområde). Always logged.
 */
export async function reassignLead(leadId: string, newUserId: string, reason: string) {
  const supabase = await createServerSupabase();
  const user = await getUser(supabase);
  if (!user) return { error: "Ikke logget inn" };

  const now = touch();
  const { error } = await supabase
    .from("leads")
    .update({ assigned_to: newUserId, last_activity_at: now })
    .eq("id", leadId);
  if (error) return { error: error.message };

  await logActivity(supabase, leadId, user.id, "reassigned", { assigned_to: newUserId }, reason);
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  return { success: true };
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
}
