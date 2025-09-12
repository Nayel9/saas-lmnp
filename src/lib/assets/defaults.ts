import { type AssetCategory } from "@/types/asset-category";

export function monthsToYearsRounded(months: number): number {
  if (!Number.isFinite(months) || months <= 0) return 1;
  const years = Math.round(months / 12);
  return years > 0 ? years : 1;
}

export function prefillYears(
  category: AssetCategory | "",
  defaults: Partial<Record<AssetCategory, number>>,
): string {
  if (!category) return "";
  const m = defaults[category];
  if (!m || !Number.isFinite(m) || m <= 0) return "";
  return String(monthsToYearsRounded(m));
}

