# LMNP App (MVP)

Stack: Next 15 • React 19 • TypeScript (strict) • Tailwind v4 (CLI) • Mantine • Supabase (Auth + Postgres + RLS) • Prisma • pnpm

## Scripts principaux
- `pnpm dev` (Turbopack + Tailwind CLI watch)
- `pnpm build`
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

## Évolutions possibles
- CRUD UI pour journal & immobilisations.
- Calcul amortissements automatiques à partir des assets.
- Exports fiscaux / FEC.
- Tests e2e (Playwright) + tests unitaires services.
- Mode sombre.

---
RLS: exécuter `supabase/policies.sql` après création des tables (si non gérées via l'interface).
