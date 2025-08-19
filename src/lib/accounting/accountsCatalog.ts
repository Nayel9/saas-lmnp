import rawCatalog from '../../../config/accounts-catalog.json';
import { z } from 'zod';

const AccountSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  appliesTo: z.array(z.enum(['achat','vente'])).nonempty(),
  rubrique: z.string().min(1)
});
const CatalogSchema = z.array(AccountSchema);
export type CatalogAccount = z.infer<typeof AccountSchema>;

let cached: CatalogAccount[] | null = null;

export function loadCatalog(): CatalogAccount[] {
  if (cached) return cached;
  const parsed = CatalogSchema.safeParse(rawCatalog);
  if (!parsed.success) throw new Error('Catalogue comptes invalide');
  cached = parsed.data.slice().sort((a,b)=> a.code.localeCompare(b.code));
  return cached;
}

export function listFor(type: 'achat'|'vente'): CatalogAccount[] {
  return loadCatalog().filter(a => a.appliesTo.includes(type));
}

// isAllowed: code présent ET contient le type dans appliesTo
export function isAllowed(code: string, type: 'achat'|'vente'): boolean {
  const acc = loadCatalog().find(a=> a.code === code);
  if (!acc) return false;
  return acc.appliesTo.includes(type);
}

// findClosest: suggestion par préfixe: prendre le compte dont le code commence par input ou input commence par code, priorité plus long match; fallback 1er trié.
export function findClosest(input: string, type?: 'achat'|'vente'): CatalogAccount | undefined {
  const catalog = type ? listFor(type) : loadCatalog();
  if (!input) return catalog[0];
  let best: CatalogAccount | undefined; let bestLen = -1;
  for (const acc of catalog) {
    const c = acc.code;
    let match = 0;
    if (c.startsWith(input) || input.startsWith(c)) match = Math.min(c.length, input.length);
    else if (c.slice(0, input.length-1) === input.slice(0, input.length-1)) match = input.length-1; // tolérance mineure
    if (match > bestLen) { best = acc; bestLen = match; }
  }
  return best;
}

// Recherche full-text simple pour le dropdown
export function searchAccounts(q: string, type: 'achat'|'vente', limit=25): CatalogAccount[] {
  const norm = q.trim().toLowerCase();
  const base = listFor(type);
  if (!norm) return base.slice(0, limit);
  return base.filter(a=> a.code.includes(norm) || a.label.toLowerCase().includes(norm) || a.description.toLowerCase().includes(norm)).slice(0, limit);
}

