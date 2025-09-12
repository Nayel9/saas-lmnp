import { z } from "zod";

export const ASSET_CATEGORIES = [
  "mobilier",
  "batiment",
  "vehicule",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];
export const zAssetCategory = z.enum(ASSET_CATEGORIES);
