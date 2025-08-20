# LMNP App (MVP)

Stack: Next 15 • React 19 • TypeScript (strict) • Tailwind v4 (CLI) • Mantine • Auth.js (NextAuth v5, Credentials) • Prisma • pnpm

## Variables d'environnement
| Variable | Obligatoire | Rôle |
|----------|-------------|------|
| DATABASE_URL | oui | Connexion poolée (PgBouncer) utilisée en runtime (lectures/écritures courantes). |
| DIRECT_URL | recommandé | Connexion directe Postgres utilisée par Prisma migrate / generate (pas via PgBouncer). |
| AUTH_SECRET | oui | Clé de signature JWT / sessions (Auth.js v5). Générer via `openssl rand -hex 32`. |
| NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL | dev/local | URL publique de l'app (callbacks). Utiliser http://localhost:3000 en local. |
| ADMIN_SEED_EMAIL | optionnel | Email utilisé par `pnpm admin:ensure`. |
| ADMIN_SEED_PASSWORD | optionnel | Mot de passe associé. |
| ADMIN_SEED_NAME | optionnel | Nom affiché lors du seed admin. |
| NODE_ENV | auto | Environnement (dev / production). |

Supprimés / obsolètes (après retrait Supabase pour auth) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (gardés seulement si besoin d'outils externes ou de la politique RLS future). 

## Authentification (NextAuth v5 Credentials)
- Provider actif: Credentials (email + mot de passe hashé bcrypt)
- Providers futurs (commentés / à activer plus tard): Google, Apple
- Inscription: `POST /api/users` (zod + bcrypt) – route forcée en runtime Node (`export const runtime = 'nodejs'`) car bcrypt JS n'est pas compatible Edge
- Connexion: `signIn('credentials', { email, password })`
- Session: JWT (`session.user.id`, `role`, `plan`)
- Accès: `/dashboard`, `/assets`, `/journal/*`, `/reports/*` protégés; `/admin` et `/reports/*` exigent rôle `admin`
- Tests: unitaires (validateCredentials, signup) + E2E (login/logout, iso multi-utilisateurs)

### Flux admin seed
```
pnpm admin:ensure  # crée ou met à jour l'utilisateur admin (hash bcrypt)
```
Requiert `ADMIN_SEED_EMAIL` & `ADMIN_SEED_PASSWORD`.

## Procédure DB & Migrations
### Initialisation
```bash
pnpm install
pnpm db:generate
pnpm exec prisma migrate dev  # applique migrations locales
pnpm admin:ensure             # optionnel admin
pnpm dev
```
### Reset (destructif – développement seulement)
```bash
pnpm exec prisma migrate reset --force --skip-seed
pnpm db:generate
pnpm admin:ensure
```
### Diff poolé vs direct
- `DIRECT_URL` : utilisé par Prisma CLI (évite limitations PgBouncer sur transactions longues / DDL)
- `DATABASE_URL` : utilisé au runtime (pool vivant). 

## Scripts principaux
- `pnpm dev` (Turbopack + Tailwind watch)
- `pnpm build` / `pnpm start`
- `pnpm admin:ensure`
- `pnpm db:migrate`, `pnpm db:push`, `pnpm db:studio`, `pnpm db:generate`
- `pnpm lint`, `pnpm typecheck`
- `pnpm test` (unit) • `pnpm test:e2e` (Playwright)

## Base de données & Prisma
Voir `prisma/schema.prisma` : domaines (Property, Income, Expense, Amortization, journal_entries, assets) + tables Auth (User, Account, Session, VerificationToken). 
Migrations récentes ajoutent journal, assets et tables Auth (`add_user_auth`).

## Journaux, Immobilisations, Rapports
- Journal Achats / Ventes: CRUD + exports CSV/XLSX/PDF
- Immobilisations: calcul amortissements (linéaire) + exports CSV/XLSX
- Rapports: Balance, Grand Livre, 2033-A / C / E (exports PDF/XLSX/CSV selon cas)

## Migration depuis Supabase
- Auth Supabase retirée (plus de dépendance à `@supabase/supabase-js` dans `src/`)
- Scripts `dbSeedDemo.ts` & `dbUnseedDemo.ts` simplifiés (placeholders) — à supprimer ou réimplémenter si réintégration future
- Dossier `supabase/` conservé pour historique (policies RLS) : non utilisé par l'app actuelle
- Partition multi-tenant assurée applicativement via `user_id`

## Tests
### Unitaires
`pnpm test` couvre: formatage, sécurité headers, mapping rubriques, amortissement, ledger, PDF, calculs fiscaux, auth credentials.
### E2E (Playwright)
Scénarios validés:
1. Login / logout admin
2. Journaux achats & ventes (CRUD + exports)
3. Immobilisation + amortissements + exports
4. Rapports Balance & Grand Livre + 2033 A/C/E exports
5. Isolation second utilisateur (données non croisées)

Commande:
```bash
pnpm test:e2e
```

## Sécurité / Bonnes pratiques
- Bcrypt cost 10 (modifiable si besoin) – privilégier Node runtime
- JWT signé via `AUTH_SECRET`
- Pas de secrets exposés côté client
- Exports protégés par session + rôle admin

## Dépannage
| Problème | Cause probable | Solution |
|----------|----------------|----------|
| `The column User.image does not exist` | Drift DB vs schema | `prisma migrate dev` ou reset (dev) |
| Erreur bcrypt en Edge | Runtime incompatible | Ajouter `export const runtime = 'nodejs'` à la route concernée |
| 500 signup après reset | Migrations non appliquées | Re-exécuter reset + generate |
| Échecs tests DB distants | Pool PgBouncer + DDL | Utiliser `DIRECT_URL` pour migrations |

## Roadmap
- Activer OAuth Google / Apple (providers déjà structurés)
- RLS Postgres (policies user_id) pour renforcement multi-tenant
- Billing / abonnements (plans pro)
- Optimisation perfs exports volumineux
- Alertes / notifications financières

## Changements récents (PR)
- Suppression imports Supabase restants
- Ajout tables Auth + migration `add_user_auth`
- Forçage runtime nodejs pour route signup
- Refactor typage tests (remplacement `any` par types explicites)
- Mocks Prisma mémoire pour tests unitaires lourds sans DB externe
- E2E consolidés (5 scénarios) couvrant isolation et exports
