import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { classifyLead, Vertical } from "@/lib/classify";
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
    .select("id, vertical, classification_config")
    .eq("slug", organization_slug)
    .single();

  if (orgError || !org) {
    return NextResponse.json({ error: "Unknown organization" }, { status: 404 });
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

  // 3. Resolve location by name within the org (routing key)
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

  // 4. Classify (AI suggestion — always overridable downstream)
  const productContext = [normalized.product_category, normalized.product_name, normalized.product_variant]
    .filter(Boolean)
    .join(" ");

  const classification = await classifyLead({
    message: normalized.message,
    vertical: org.vertical as Vertical,
    productContext: productContext || null,
    orgHints: (org.classification_config as any)?.hints ?? null,
  });

  // 5. Insert lead
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
      queue: classification.queue,
      temperature: classification.temperature,
      ai_classification: classification,
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

  // 6. Log creation + classification activity
  await supabase.from("lead_activities").insert([
    {
      lead_id: lead.id,
      user_id: null,
      activity_type: "created",
      new_value: { source_channel: normalized.source_channel },
    },
    {
      lead_id: lead.id,
      user_id: null,
      activity_type: "classified",
      new_value: classification,
    },
  ]);

  // 7. Mirror into marketing_contacts if consent given
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

  return NextResponse.json({ status: "ok", lead_id: lead.id, classification });
}
