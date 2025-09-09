import { parsePhoneNumberFromString } from "libphonenumber-js";

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    // Essai sans pays par défaut; fallback FR
    let pn = parsePhoneNumberFromString(trimmed);
    if (!pn) pn = parsePhoneNumberFromString(trimmed, "FR");
    if (pn && pn.isValid()) return pn.number; // format E.164
  } catch {
    /* ignore */
  }
  return null; // si invalide
}
