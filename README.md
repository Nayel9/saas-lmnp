# LMNP App (MVP)

Stack: Next 15 • React 19 • TypeScript (strict) • Tailwind v4 (CLI) • Mantine • Auth.js (NextAuth v5, Credentials) • Prisma • pnpm

## Features
- Journaux Achats/Ventes avec pièces jointes et export
- Immobilisations + tableaux d’amortissement (CSV/XLSX)
- Rapports 2033A/C/E, Balance, Grand-livre
- Exports pièces (ZIP + index)
- Synthèse : compte de résultat simple
  - Revenus = ventes hors cautions (isDeposit=true exclues)
  - Dépenses = achats hors comptes d’amortissement
  - Amortissements = dotations (comptes 6811*)
  - Résultat = Revenus – Dépenses – Amortissements
- Synthèse : bilan simple (nouveau)
  - ACTIF: Immobilisations nettes (VNC), Trésorerie (MVP: ventes hors cautions – achats sur l’année)
  - PASSIF: Cautions détenues (ventes isDeposit=true de l’année), Autres dettes (placeholder 0)
  - Équilibre affiché avec “Écart d’ouverture” si besoin

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

## Authentification (NextAuth v5 Credentials)
- Provider actif: Credentials (email + mot de passe hashé bcrypt)
- Inscription: `POST /api/users` (zod + bcrypt)
- Session: JWT (`session.user.id`, `role`, `plan`)
- Pages protégées: `/dashboard`, `/assets`, `/journal/*`, `/reports/*`, `/synthesis`, `/admin` (rôle admin)

## Stockage S3 (pièces jointes)
Implémenté via `src/lib/storage/s3.ts` (AWS SDK v3).
- Upload direct: presigned POST (`/api/uploads/presign`)
- Download/preview: URLs signées
- Variables requises: S3_BUCKET et S3_REGION ou S3_ENDPOINT; credentials recommandés
- Mode mock local: storageKey préfixé `mock/` lit depuis `.uploads/`

## Synthèse
### Compte de résultat (simple)
- API: `GET /api/synthesis/income-statement?property=<uuid>&year=YYYY`
- Page: `/synthesis?tab=result` (sélecteurs Bien + Année)
- Calcul: Revenus (ventes hors cautions) – Dépenses (achats hors 6811) – Amortissements (6811)

### Bilan (simple)
- API: `GET /api/synthesis/balance?property=<uuid>&year=YYYY`
- Page: `/synthesis?tab=balance` (sélecteurs Bien + Année)
- Calculs:
  - VNC (immobilisations nettes) = Σ (coût – amort cumulé ≤ 31/12)
  - Trésorerie (MVP) = Σ ventes (isDeposit=false) – Σ achats (sur l’année)
  - Cautions détenues = Σ ventes (isDeposit=true) sur l’année (MVP)
  - Autres dettes = 0 (placeholder)
- Retour JSON: `{ actif: { vnc, treso, total }, passif: { cautions, dettes, total }, ecart }`

## Scripts
- Dév: `pnpm dev`
- Build: `pnpm build`
- Lint / Types: `pnpm lint`, `pnpm typecheck`
- Tests: `pnpm test` (Vitest), `pnpm test:e2e` (Playwright)
- DB: `pnpm db:*`
- Admin: `pnpm admin:ensure`

## Screens
- Synthèse → `/synthesis` : onglets “Résultat (simple)” et “Bilan (simple)”.
  - Bilan: 2 cartes Actif/Passif avec totaux + indicateur d’équilibre.

## Changements récents (PR)
- L3: Sécurisation auth (redirect sûr, rate‑limit, headers)
  - Redirect callback NextAuth sécurisé
  - Rate‑limit token bucket (signup, resend-verification, profile)
  - CSP/headers par défaut renforcés
- [2025-09-09] Synthèse : compte de résultat simple
  - API `/api/synthesis/income-statement` + UI `/synthesis?tab=result`
  - Agrégations revenus/dépenses/amortissements
  - Tests unitaires + intégration
- [2025-09-09] Synthèse : bilan simple
  - API `/api/synthesis/balance` + UI `/synthesis?tab=balance`
  - VNC (assets), trésorerie MVP, cautions détenues, totaux Actif/Passif, écart affiché
  - Tests unitaires + intégration
