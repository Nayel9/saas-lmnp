export interface SeedJournalEntryBase {
  type: 'achat' | 'vente';
  date: string; // ISO (YYYY-MM-DD)
  account_code: string;
  designation: string; // sans suffixe
  tier: string;
  amount: number; // peut être négatif pour remise
  currency: string;
}
export interface SeedAssetBase {
  label: string; // sans suffixe
  amount_ht: number;
  duration_years: number;
  acquisition_date: string; // YYYY-MM-DD
  account_code: string;
}
export interface SeedData { journal: SeedJournalEntryBase[]; assets: SeedAssetBase[]; }

export const SEED_SUFFIX = ' [seed]';

export function buildSeedData(): SeedData {
  const journal: SeedJournalEntryBase[] = [
    // 2025 Achats
    { type: 'achat', date: '2025-01-15', account_code: '606',  designation: 'Fournitures bureau',        tier: 'Fournisseur ABC', amount: 350.00, currency: 'EUR' },
    { type: 'achat', date: '2025-02-10', account_code: '6063', designation: 'Petit outillage',           tier: 'Brico Services',  amount: 180.00, currency: 'EUR' },
    { type: 'achat', date: '2025-03-05', account_code: '615',  designation: 'Réparation chauffe-eau',    tier: 'Plombier Martin', amount: 240.00, currency: 'EUR' },
    { type: 'achat', date: '2025-03-28', account_code: '616',  designation: 'Assurance multirisque',     tier: 'Assurix',          amount: 120.00, currency: 'EUR' },
    { type: 'achat', date: '2025-04-07', account_code: '62',   designation: 'Honoraires comptables',     tier: 'Cabinet ComptaX', amount: 300.00, currency: 'EUR' },
    { type: 'achat', date: '2025-04-20', account_code: '627',  designation: 'Frais bancaires mensuels',  tier: 'Banque Z',         amount: 12.50,  currency: 'EUR' },
    { type: 'achat', date: '2025-05-15', account_code: '635',  designation: 'Taxe foncière (acompte)',   tier: 'DGFIP',            amount: 400.00, currency: 'EUR' },
    // 2025 Ventes
    { type: 'vente', date: '2025-01-31', account_code: '706',  designation: 'Loyer janvier',             tier: 'Locataire Dupont', amount: 1200.00, currency: 'EUR' },
    { type: 'vente', date: '2025-02-28', account_code: '706',  designation: 'Loyer février',             tier: 'Locataire Dupont', amount: 1200.00, currency: 'EUR' },
    { type: 'vente', date: '2025-03-31', account_code: '709',  designation: 'Remise commerciale',        tier: 'Locataire Dupont', amount: -50.00,  currency: 'EUR' },
    // 2024 tests
    { type: 'vente', date: '2024-12-31', account_code: '706',  designation: 'Loyer décembre',            tier: 'Locataire Durand', amount: 1200.00, currency: 'EUR' },
    { type: 'achat', date: '2024-11-15', account_code: '606',  designation: 'Fournitures ménage',        tier: 'Fournisseur ABC',  amount: 90.00,  currency: 'EUR' },
  ];
  const assets: SeedAssetBase[] = [
    { label: 'Mobil-home',     amount_ht: 20000.00, duration_years: 10, acquisition_date: '2024-04-01', account_code: '2183' },
    { label: 'Électroménager', amount_ht: 3000.00,  duration_years: 3,  acquisition_date: '2025-01-15', account_code: '2155' },
  ];
  return { journal, assets };
}

