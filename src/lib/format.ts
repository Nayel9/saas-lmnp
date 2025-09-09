export function formatAmount(
  value: number | string | null | undefined,
): string {
  if (value == null || value === "") return "0,00";
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n)) return "0,00";
  return n.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDateISO(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function parseFrenchNumber(input: string): number {
  // remplace virgule par point, supprime espaces fines
  const cleaned = input.replace(/\s+/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  if (isNaN(n)) throw new Error("Nombre invalide");
  return n;
}
