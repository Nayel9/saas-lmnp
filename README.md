# LMNP App (MVP)

[![CI](https://github.com/Nayel9/saas-lmnp/actions/workflows/ci.yml/badge.svg)](https://github.com/Nayel9/saas-lmnp/actions/workflows/ci.yml)

Stack: Next 15 • React 19 • TypeScript (strict) • Tailwind v4 (CLI) • Mantine • Supabase (Auth + Postgres + RLS) • Prisma • pnpm

## Scripts principaux
- `pnpm dev` (Turbopack + Tailwind CLI watch)
- `pnpm build`
- `pnpm preview` (prévisualisation prod intelligente: rebuild seulement si nécessaire)
- `pnpm preview:fast` (démarre directement `next start` en supposant la build à jour)
- `pnpm css:dev` / `pnpm css:build`
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` / `pnpm db:studio` / `pnpm db:format`
- `pnpm db:seed:demo` (seed démo propriétés + immobilisations + écritures journal)
- `pnpm db:test` / `pnpm db:test:pg` / `pnpm db:diagnose`
- `pnpm admin:ensure` (création/màj user admin)
- `pnpm lint`

## Nouvelles tables comptables
Ajout (migration `add_journal_assets`):
- `journal_entries`: écritures (type ENUM achat|vente, account_code, amount, currency, tier, designation, date)
- `assets`: immobilisations (label, amount_ht, duration_years, acquisition_date, account_code)

Enum Prisma: `JournalEntryType` (achat, vente).

RLS (Row Level Security) activé pour toutes les tables; politiques: `user_id = auth.uid()`.
Le fichier `supabase/policies.sql` contient les commandes à exécuter dans l'interface SQL Supabase (ou via `psql`).

## Supabase
Helper serveur: `createSupabaseServerClient()` (`src/lib/supabase/server.ts`).
Middleware: protection `/dashboard` & `/admin` + contrôle rôle admin.

## Prisma
Schéma: `prisma/schema.prisma` (urls: `DATABASE_URL` pool pgbouncer + `DIRECT_URL` migrations).
Client singleton: `src/lib/prisma.ts`.

## Mise en route locale
Créer `.env.local` (pas de `.env.example`). Puis:
```bash
pnpm install
pnpm db:generate
pnpm db:migrate --name init_lmnp   # première migration si pas encore appliquée
pnpm db:migrate --name add_journal_assets  # ou déjà incluse si migration créée
pnpm admin:ensure   # optionnel (crée l'admin test)
pnpm db:seed:demo   # remplit assets + journal (nécessite SERVICE_ROLE)
pnpm dev
```
http://localhost:3000

## Variables d'environnement (.env.local uniquement)
Obligatoires:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `DATABASE_URL` (pool PgBouncer 6543, `?pgbouncer=true`)
- `DIRECT_URL` (port 5432 direct)

Optionnelles:
- `SUPABASE_SERVICE_ROLE_KEY` (scripts admin/seed – JAMAIS côté client)
- `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` (utilisées par `pnpm admin:ensure`)

## Accès administrateur
1. Définir `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` dans `.env.local`.
2. Lancer `pnpm admin:ensure` → crée ou met à jour l'utilisateur avec `app_metadata.role=admin`.
3. Connexion via `/login` → un lien "Accès administration" apparaît sur `/dashboard` si rôle admin.
4. Page admin: `/admin` (protégée middleware + revalidation côté page).

## Parcours de test manuel
1. `pnpm dev`.
2. Visiter `/` → landing + bouton login.
3. `/login` → inscription/connexion.
4. Redirection vers `/dashboard` → création d'un bien OK.
5. `pnpm db:seed:demo` → assets + écritures disponibles (vérifier via Prisma Studio / requêtes SQL).
6. Si admin seed créé: accéder `/admin`.
7. `pnpm lint` → aucun warning.
8. `pnpm db:test` → vérifie connexion Postgres.

## Conventions
- Alias `@/*`.
- Utilitaires UI: `card`, `btn`, `btn-primary`, `input`.
- Couleurs via tokens Tailwind v4 (@theme).

## Changelog refactor récent
- Harmonisation UI (landing, login, dashboard) → tokens design.
- Ajout rôle admin (helper `auth.ts`, middleware, page `/admin`).
- Scripts DB & diagnostics réseau.
- Ajout barre navigation + logout.
- Nouvelles tables `journal_entries`, `assets` + RLS associé.
- Seed démo (`pnpm db:seed:demo`).
- Journal Achats (P1‑A) & Journal Ventes (P1‑B) : CRUD complet, exports CSV/XLSX, validations, ownership.
- Ajout Immobilisations (P1‑C) : CRUD + calcul amortissement linéaire + export CSV.

## Évolutions possibles
- CRUD UI pour journal & immobilisations.
- Calcul amortissements automatiques à partir des assets.
- Exports fiscaux / FEC.
- Tests e2e (Playwright) + tests unitaires services.
- Mode sombre.

## Journaux comptables (Achats & Ventes)
Fonctionnalités:
- Pages: `/journal/achats` et `/journal/ventes`
- Pagination serveur (20 lignes), tri date desc
- Filtres via query params: `page`, `from`, `to`, `tier`, `q`
- CRUD (modal Ajouter / Modifier, suppression avec server action) + validations Zod client & serveur
- Export CSV & XLSX:
  - Route API: `/api/journal/achats/export?format=csv|xlsx` (mêmes critères de filtre applicables)
  - Route API: `/api/journal/ventes/export?format=csv|xlsx`
  - Scripts CLI: `pnpm export:achats:csv|xlsx`, `pnpm export:ventes:csv|xlsx` (variables d’environnement FROM, TO, TIER, SEARCH utilisables)

## Immobilisations & Amortissements
Fonctionnalités:
- Page `/assets`: liste paginée (20), filtres query: `page`, `from`, `to`, `q`.
- CRUD (modal ajout / modification, suppression via server action) avec validations Zod + vérif ownership.
- Champs: label, amount_ht, duration_years, acquisition_date, account_code.
- Page détail `/assets/[id]/amortization`: calcul linéaire avec prorata temporis 1ère année (base mois restants) + export CSV.
- Calcul: dotation annuelle = montant / durée. 1ère année: dotation * (mois restants/12). Dernière année ajuste les arrondis pour que cumul = montant.
- Exports: `/api/assets/:id/amortization/export?format=csv`.
- Tests: voir `asset-amortization.test.ts` (prorata, arrondis, cumul).

Scripts utiles:
```bash
pnpm export:achats:csv      # déjà présent (journaux)
pnpm export:ventes:xlsx     # idem ventes
# Amortissement (via route API) -> curl exemple
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/assets/<assetId>/amortization/export?format=csv" -o amort.csv
```

## Rapports
### Balance (P2-A)
Page `/reports/balance` (accès admin) : agrégation par `account_code` à partir de `journal_entries`.
Règles:
- `achat` => débit
- `vente` => crédit
- solde = total_debit - total_credit
Filtres: `from`, `to`, `account_code` (contient), `q` (recherche designation/tier/account_code). RLS user_id appliqué.
Exports: `/api/reports/balance/export?format=csv|pdf`.
Limites: pas de pagination (OK dataset limité); PDF tronqué à 5000 lignes.

### Grand Livre (P2-B)
Page `/reports/ledger` (admin) – affichage des écritures d'un compte avec solde courant.
Règles: achat=Débit, vente=Crédit, solde courant cumul (débit-crédit).
Filtres: `account_code` (obligatoire), `from`, `to`, `q` (designation|tier|account_code partiel).
Exports: `/api/reports/ledger/export?account_code=...&format=csv|pdf` (+ from/to/q). Troncation PDF >5000 lignes (header `X-Truncated: true`).
Intégration: depuis la Balance, lien "Grand livre" pré-remplit compte & période.
Limites: pas de pagination (warning si volumétrie à implémenter plus tard).

### 2033-C (Compte de résultat simplifié)
Page: `/reports/2033c` (admin).
Filtres: `from`, `to`, `q` (designation|tier|account_code), `account_code`.
API JSON: `/api/reports/2033c` → `{ rubriques: [...], totals: { produits, charges, amortissements, resultat } }`.
Export XLSX: `/api/reports/2033c/export?format=xlsx` (onglets `2033C`, `Meta`). Header `X-Truncated: true` si > limites.
Structure UI:
- Produits: CA, Rabais (négatif)
- Charges: externes, assurances, impôts, services (selon mapping dynamique)
- Dotations: amortissements (6811*)
Totaux calculés: Total Produits, Total Charges, Dotations, Résultat = Produits - Charges - Dotations.
Extension: ajouter prefixes dans `config/config-pcg.json` (form 2033C). La page reflète automatiquement.

### 2033-E (État des amortissements)
Page: `/reports/2033e` (admin). Paramètre `year` (défaut année courante) + filtre `q` sur label.
API JSON: `/api/reports/2033e?year=YYYY[&q=...]` -> `{ year, rows:[{asset_id,label,valeur_origine,amortissements_anterieurs,dotation_exercice,amortissements_cumules,valeur_nette}], totals, truncated }`.
Export XLSX: `/api/reports/2033e/export?year=YYYY` (onglets `2033E`, `Meta`). Prorata temporis 1ère année (mois restants) et arrondis identiques à `computeLinearAmortization`.
Troncation: >10k actifs (header `X-Truncated: true`).

### 2033-A (Bilan simplifié v1)
Page: `/reports/2033a` (admin). Paramètre `year` (défaut année courante) + filtre `q` sur labels assets.
API JSON: `/api/reports/2033a?year=YYYY` → champs: immobilisations_brutes, amortissements_cumules, immobilisations_nettes, tresorerie (0 v1), actif_total, capitaux_propres_equilibrage (pour équilibrage), count_assets, truncated.
Export XLSX: `/api/reports/2033a/export?year=YYYY` (onglets `2033A_Actif`, `2033A_Passif`, `Meta`).
Limites v1: pas de dettes/détails trésorerie; capitaux propres calculés comme variable d’équilibre. Évolutions: ajout comptes tiers, dettes financières, disponibilités.

## Intégration Continue (CI)
Pipeline GitHub Actions (workflow `ci.yml`) : lint, typecheck, tests unitaires, build et e2e Playwright (artefacts exports dans `e2e-exports`). Variables d'environnement injectées via secrets (Supabase + DB). Pour reproduire en local :
```bash
pnpm lint
pnpm typecheck
pnpm test -- --run
pnpm build
pnpm test:e2e
```

---
RLS: exécuter `supabase/policies.sql` après création des tables (si non gérées via l'interface).

## Extension Mapping PCG -> Rubriques (2033C)
Le moteur de mapping (P4-A) lit `config/config-pcg.json` (liste d'objets):
```json
{
  "account_prefix": "706",
  "rubrique": "CA",
  "form": "2033C",
  "label": "Chiffre d’affaires"
}
```
Règles:
- `account_prefix`: préfixe de compte (priorité au plus long si chevauchement: ex. `615` avant `61` ou `6`).
- `rubrique`: identifiant fonctionnel (ex: `ChargesExternes`, `CA`).
- `form`: code formulaire cible (actuellement `2033C`).
- `label`: libellé lisible.

L'utilitaire `mapToRubriques` agrège une liste d'écritures (type achat=Débit / vente=Crédit) en montants par rubrique (+ dataset amortissements `6811*`).

Ajouter un nouveau mapping:
1. Insérer une nouvelle ligne JSON dans `config/config-pcg.json` (respecter le tri optionnel par granularité si souhaité).
2. (Optionnel) Ajouter un test ciblé dans `src/lib/accounting/mapToRubriques.test.ts`.
3. Lancer `pnpm test`.

Comptes non mappés: ignorés silencieusement (extensible ultérieurement: warning ou fallback). Pour étendre à d'autres formulaires (2033A, 2033E), ajouter des règles avec `form` différent puis filtrer côté service/API.

Résultat courant: helper `computeResultatCourant(rubriques)` calcule (Produits nets - Charges) où Produits nets = `CA` - `CA_Moins`.

## Catalogue de comptes (PCG)
Fichier: `config/accounts-catalog.json` – liste d'objets `{ code, label, description, appliesTo:["achat"|"vente"...], rubrique }`.
Utilisation:
- Formulaires Achats/Ventes: dropdown avec recherche plein texte (code, label, description) + fallback saisie libre.
- Validation: un compte explicitement associé à l'autre journal est rejeté (ex: 706 dans Achats → erreur). Codes hors catalogue acceptés mais marqués "Non mappé" avec suggestion (prefix match le plus pertinent).
Extension:
1. Ajouter entrée JSON (tri par code facultatif).
2. (Optionnel) Ajouter test dans `accountsCatalog.test.ts`.
3. Lancer `pnpm test`.
Fonctions utilitaires: `listFor(type)`, `isAllowed(code,type)`, `findClosest(code,type)`, `searchAccounts(q,type)`.

## Seed de démo
Commandes:
- `pnpm db:seed:demo` (insère/maj écritures & assets suffixés "[seed]")
- `pnpm db:unseed:demo` (supprime uniquement ces données)
Variables requises: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_SEED_EMAIL, ADMIN_SEED_PASSWORD.
Scénarios après seed:
- Journaux: /journal/achats et /journal/ventes (filtres 2025)
- 2033C: période 2025 (CA = 2400, rabais -50, charges achats ≈ 1602.5)
- 2033E: années 2024 & 2025 (deux immobilisations)
- 2033A: années 2024 & 2025 (nettes cohérentes)
Idempotence: ré-exécuter la commande n’insère pas de doublon.
