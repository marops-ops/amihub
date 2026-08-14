// Plain constants — kept out of lib/actions.ts because a "use server" file
// may only export async functions, not objects/arrays.
export const IKKE_AKTUELT_REASONS = [
  "Ingen kontakt",
  "Feil kontaktinformasjon",
  "Konkurrent",
  "Ikke finansiering",
  "Kun informasjon",
  "Annet",
] as const;

export const KUNDE_AVSLATT_REASONS = [
  "Pris",
  "Leveringstid",
  "Valgte annet merke",
  "Finansiering",
  "Ombestemte seg",
  "Ingen respons",
  "Annet",
] as const;
