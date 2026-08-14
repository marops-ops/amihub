import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  normalizeRohneSelmerWebsiteForm,
  normalizeManualLead,
  NormalizedLead,
} from "@/lib/normalize";

type IntakeSource = "rohneselmer_website" | "manual";

interface IntakeRequestBody {
  organization_slug: string;
  source: IntakeSource;
  payload: Record<string, unknown>;
  form_action_url?: string | null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as IntakeRequestBody;
  const { organization_slug, source, payload, form_action_url } = body;

  if (!organization_slug || !source || !payload) {
    return NextResponse.json(
      { error: "organization_slug, source, and payload are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1. Resolve organization
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, vertical")
    .eq("slug", organization_slug)
    .single();

  if (orgError || !org) {
    console.error("Organization lookup failed:", { organization_slug, orgError });
    return NextResponse.json(
      { error: "Unknown organization", debug: orgError?.message ?? null },
      { status: 404 }
    );
  }

  // 2. Normalize payload -> canonical shape
  let normalized: NormalizedLead;
  switch (source) {
    case "rohneselmer_website":
      normalized = normalizeRohneSelmerWebsiteForm(payload, form_action_url ?? null);
      break;
    case "manual":
      normalized = normalizeManualLead(payload as any);
      break;
    default:
      return NextResponse.json({ error: `Unsupported source: ${source}` }, { status: 400 });
  }

  // 3. Resolve location by name within the org (routing key — determines
  // which sellers get notified and who can see/accept this lead)
  let locationId: string | null = null;
  if (normalized.location_name) {
    const { data: location } = await supabase
      .from("locations")
      .select("id")
      .eq("organization_id", org.id)
      .ilike("name", normalized.location_name)
      .maybeSingle();
    locationId = location?.id ?? null;
  }

  // 4. Insert lead — status always starts at 'nye'. Contact-SLA clock
  // (4 hours) starts implicitly from created_at, no separate field needed.
  const { data: lead, error: insertError } = await supabase
    .from("leads")
    .insert({
      organization_id: org.id,
      location_id: locationId,
      first_name: normalized.first_name,
      last_name: normalized.last_name,
      email: normalized.email,
      phone: normalized.phone,
      message: normalized.message,
      product_category: normalized.product_category,
      product_name: normalized.product_name,
      product_variant: normalized.product_variant,
      source_channel: normalized.source_channel,
      source_url: normalized.source_url,
      external_lead_id: normalized.external_lead_id,
      raw_payload: normalized.raw_payload,
      marketing_consent: normalized.marketing_consent,
      marketing_consent_at: normalized.marketing_consent ? new Date().toISOString() : null,
      status: "nye",
    })
    .select()
    .single();

  if (insertError) {
    // Duplicate webhook delivery (same external_lead_id) is expected and not an error
    if (insertError.code === "23505") {
      return NextResponse.json({ status: "duplicate_ignored" }, { status: 200 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // 5. Log creation
  await supabase.from("lead_activities").insert({
    lead_id: lead.id,
    user_id: null,
    activity_type: "created",
    new_value: { source_channel: normalized.source_channel },
  });

  // 6. Mirror into marketing_contacts if consent given
  if (normalized.marketing_consent) {
    await supabase.from("marketing_contacts").insert({
      organization_id: org.id,
      lead_id: lead.id,
      first_name: normalized.first_name,
      last_name: normalized.last_name,
      email: normalized.email,
      phone: normalized.phone,
      consent_at: new Date().toISOString(),
    });
  }

  // TODO (email varsel): send e-post til alle selgere på locationId når
  // e-post-tjeneste (Resend) er koblet på — brief krever dette ved nye leads.

  return NextResponse.json({ status: "ok", lead_id: lead.id });
}
