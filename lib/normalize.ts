export interface NormalizedLead {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  location_name: string | null; // matched against locations.name for the org
  product_category: string | null;
  product_name: string | null;
  product_variant: string | null;
  source_channel: "website" | "meta" | "google" | "manual";
  source_url: string | null;
  external_lead_id: string | null;
  marketing_consent: boolean;
  raw_payload: unknown;
}

/**
 * Normalizes RøhneSelmer's website contact form submission.
 * Expected raw shape (from their "Kontaktskjema"):
 *   { fornavn, etternavn, epost, telefon, forhandler, sporsmal,
 *     markedsforing_samtykke, submission_url }
 *
 * Vehicle context arrives as query params on the form's action URL
 * (VehicleMake, VehicleModel, SubmissionUrl) — pass the full URL in
 * `formActionUrl` and this function extracts them.
 */
export function normalizeRohneSelmerWebsiteForm(
  raw: Record<string, unknown>,
  formActionUrl: string | null
): NormalizedLead {
  const params = formActionUrl ? new URL(formActionUrl).searchParams : null;

  return {
    first_name: (raw.fornavn as string) ?? null,
    last_name: (raw.etternavn as string) ?? null,
    email: (raw.epost as string) ?? null,
    phone: (raw.telefon as string) ?? null,
    message: (raw.sporsmal as string) ?? null,
    location_name: (raw.forhandler as string) ?? null,
    product_category: params?.get("VehicleMake") ?? null,
    product_name: params?.get("VehicleModel") ?? null,
    product_variant: null,
    source_channel: "website",
    source_url: params?.get("SubmissionUrl") ?? formActionUrl,
    external_lead_id: null, // website forms have no natural dedup id
    marketing_consent: raw.markedsforing_samtykke === true || raw.markedsforing_samtykke === "Ja",
    raw_payload: raw,
  };
}

/**
 * Normalizes a manually-entered lead (phone call, walk-in, etc.)
 * entered directly through the CRM UI.
 */
export function normalizeManualLead(raw: {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  message?: string;
  location_name?: string;
  product_category?: string;
  product_name?: string;
  product_variant?: string;
  marketing_consent?: boolean;
}): NormalizedLead {
  return {
    first_name: raw.first_name ?? null,
    last_name: raw.last_name ?? null,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    message: raw.message ?? null,
    location_name: raw.location_name ?? null,
    product_category: raw.product_category ?? null,
    product_name: raw.product_name ?? null,
    product_variant: raw.product_variant ?? null,
    source_channel: "manual",
    source_url: null,
    external_lead_id: null,
    marketing_consent: raw.marketing_consent ?? false,
    raw_payload: raw,
  };
}

// Meta and Google normalizers are added in step 6 (native ad webhooks) —
// same NormalizedLead shape, different field mapping per platform.
