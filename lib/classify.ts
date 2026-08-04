import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export type Vertical = "automotive" | "ecommerce" | "travel" | "generic";

export interface ClassificationResult {
  queue: "sales" | "helpdesk";
  temperature: "kald" | "varm" | "het" | null;
  intent_tags: string[]; // e.g. ["prøvekjøring"]
  reasoning: string;
}

const VERTICAL_HINTS: Record<Vertical, string> = {
  automotive:
    "Dette er en bilforhandler. 'Het' = ønsker prøvekjøring, pris/finansiering nå, eller klar til å kjøpe. 'Varm' = konkret interesse for en spesifikk modell/bil. 'Kald' = generell info-forespørsel. Support-spørsmål: reklamasjon, verkstedtime, åpningstider, garanti.",
  ecommerce:
    "Dette er en nettbutikk. 'Het' = spør om lagerstatus/rask levering fordi de vil kjøpe nå. 'Varm' = spør om spesifikt produkt. 'Kald' = generell interesse. Support: retur, reklamasjon, sporing av ordre.",
  travel:
    "Dette er et reiselivsselskap. 'Het' = konkrete datoer, ønsker å booke. 'Varm' = interesse for spesifikk reise/pakke. 'Kald' = generell inspirasjon. Support: avbestilling, forsikring, eksisterende booking.",
  generic:
    "Vurder temperatur ut fra kjøpsintensjon i teksten: konkret/tidsnær = het, interessert men ikke presserende = varm, generelt/uklart = kald. Support = spørsmål som ikke handler om salg av et produkt/tjeneste.",
};

/**
 * Classifies a lead's free-text message into queue (sales/helpdesk),
 * temperature, and intent tags. Always a *suggestion* — never final;
 * callers must allow manual override (see leads.classification_overridden).
 */
export async function classifyLead(params: {
  message: string | null;
  vertical: Vertical;
  productContext?: string | null; // e.g. "Ford Explorer"
  orgHints?: string | null; // organizations.classification_config free-text override
}): Promise<ClassificationResult> {
  const { message, vertical, productContext, orgHints } = params;

  // No free text to classify on — safe default, sales queue, unconfirmed temperature.
  if (!message || message.trim().length === 0) {
    return {
      queue: "sales",
      temperature: null,
      intent_tags: [],
      reasoning: "Ingen fritekst tilgjengelig for klassifisering — default til salg/kald.",
    };
  }

  const systemPrompt = `Du klassifiserer innkommende leads for et CRM-system.
${VERTICAL_HINTS[vertical]}
${orgHints ? `Tilleggskontekst fra kunden: ${orgHints}` : ""}

Svar KUN med JSON i dette eksakte formatet, ingen annen tekst:
{
  "queue": "sales" | "helpdesk",
  "temperature": "kald" | "varm" | "het",
  "intent_tags": string[],
  "reasoning": "kort norsk begrunnelse, maks 1-2 setninger"
}

Sett queue til "helpdesk" KUN hvis meldingen er et rent support-/kundeservicespørsmål
uten kjøpsintensjon (f.eks. reklamasjon, åpningstider, eksisterende ordre/avtale).
Hvis det er usikkert, velg "sales".`;

  const userPrompt = `Melding fra lead: "${message}"${
    productContext ? `\nProdukt-kontekst: ${productContext}` : ""
  }`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && "text" in textBlock ? textBlock.text : "";

  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      queue: parsed.queue === "helpdesk" ? "helpdesk" : "sales",
      temperature: ["kald", "varm", "het"].includes(parsed.temperature)
        ? parsed.temperature
        : null,
      intent_tags: Array.isArray(parsed.intent_tags) ? parsed.intent_tags : [],
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    // Classifier failed to return valid JSON — fail safe to sales queue,
    // unconfirmed temperature, and flag it in reasoning for visibility.
    return {
      queue: "sales",
      temperature: null,
      intent_tags: [],
      reasoning: "AI-klassifisering feilet (ugyldig respons) — krever manuell vurdering.",
    };
  }
}
