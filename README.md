# LMNP App (MVP)

Stack: Next 15 • React 19 • TypeScript (strict) • Tailwind v4 (CLI) • Mantine • Auth.js (NextAuth v5, Credentials) • Prisma • pnpm

## Features
- Journaux Achats/Ventes avec pièces jointes et export
- Immobilisations + tableaux d’amortissement (CSV/XLSX)
- Rapports 2033A/C/E, Balance, Grand-livre
- Exports pièces (ZIP + index)
- Synthèse : compte de résultat simple (nouveau)
  - Revenus = ventes hors cautions (isDeposit=true exclues)
  - Dépenses = achats hors comptes d’amortissement
  - Amortissements = dotations (comptes 6811*)
  - Résultat = Revenus – Dépenses – Amortissements

## Variables d'environnement
| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| DATABASE_URL | oui | Connexion poolée Postgres (runtime). |
| DIRECT_URL | recommandé | Connexion directe pour Prisma (CLI). |
| AUTH_SECRET | oui | Clé JWT/sessions Auth.js v5. |
| NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL | dev/local | URL publique de l'app. |
| ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD | optionnel | Script seed admin. |
| S3_BUCKET | oui (upload/exports) | Nom du bucket S3 compatible. |
| S3_REGION ou S3_ENDPOINT | oui | Région AWS ou endpoint S3 compatible. |
| S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY | conseillé | Credentials d’accès S3. |
| S3_FORCE_PATH_STYLE | optionnel | 'true' pour compatibilité minio/ceph. |

Supprimés / obsolètes: voir plus bas (section Auth).

## Authentification (NextAuth v5 Credentials)
- Provider actif: Credentials (email + mot de passe hashé bcrypt)
- Inscription: `POST /api/users` (zod + bcrypt)
- Session: JWT (`session.user.id`, `role`, `plan`)
- Pages protégées: `/dashboard`, `/assets`, `/journal/*`, `/reports/*`, `/synthesis`, `/admin` (rôle admin)

Sécurisation (rappel): redirect sûr, rate‑limit, headers & CSP.

## Stockage S3 (pièces jointes)
Implémenté via `src/lib/storage/s3.ts` (AWS SDK v3).
- Upload direct: presigned POST (`/api/uploads/presign`)
- Download/preview: URLs signées
- Variables requises: S3_BUCKET et S3_REGION ou S3_ENDPOINT; credentials recommandés
- Mode mock local: storageKey préfixé `mock/` lit depuis `.uploads/`

## Synthèse : compte de résultat (simple)
- Route API: `GET /api/synthesis/income-statement?property=<uuid>&year=YYYY`
- Page UI: `/synthesis` (sélecteurs Bien + Année, synchro URL)
- Agrégations (serveur / Prisma):
  - Revenus: JournalEntry type `vente`, `isDeposit=false`
  - Dépenses: JournalEntry type `achat` hors comptes `6811*`
  - Amortissements: JournalEntry type `achat` comptes `6811*`
- Accessibilité: libellés clairs, format monétaire fr-FR
- Limitation actuelle: le schéma `JournalEntry` n’a pas de `propertyId`; contrôle d’appartenance du bien effectué, mais filtrage par bien non strict (scope par utilisateur + année).

## Scripts
- Dév: `pnpm dev`
- Build: `pnpm build` (prisma generate + tailwind build + next build)
- Lint / Types: `pnpm lint`, `pnpm typecheck`
- Tests: `pnpm test` (Vitest), `pnpm test:e2e` (Playwright)
- DB: `pnpm db:*` (generate, migrate, push, studio)
- Admin: `pnpm admin:ensure`

## Screens
- Synthèse → `/synthesis` : carte “Compte de résultat (simple)” avec 4 lignes (Revenus, Dépenses, Amortissements, Résultat).

## Changements récents (PR)
- L3: Sécurisation auth (redirect sûr, rate‑limit, headers)
  - Redirect callback NextAuth sécurisé
  - Rate‑limit token bucket (signup, resend-verification, profile)
  - CSP/headers par défaut renforcés
- [2025-09-09] Synthèse : compte de résultat simple
  - Route API `/api/synthesis/income-statement` (zod + Auth v5 + Prisma)
  - Page `/synthesis` (sélecteurs bien/année, synchro URL)
  - Agrégation revenus/dépenses/amortissements et calcul du résultat
  - Tests unitaires et intégration (Vitest) ajoutés
  - Lien “Synthèse” ajouté à la barre de navigation
