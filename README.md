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
- Providers futurs: Google, LinkedIn (déjà câblés)
- Inscription: `POST /api/users` (zod + bcrypt) – route forcée en runtime Node (`export const runtime = 'nodejs'`) car bcrypt JS n'est pas compatible Edge
- Connexion: `signIn('credentials', { email, password })`
- Session: JWT (`session.user.id`, `role`, `plan`)
- Pages protégées: `/dashboard`, `/assets`, `/journal/*`, `/reports/*`; `/admin` exige rôle `admin`

### Sécurisation Auth (PR L3)
- Redirect callback sûr (anti open-redirect):
  - Implémenté dans `src/lib/auth/options.ts` → `callbacks.redirect`
  - Logique: si l'URL est relative → préfixée par `baseUrl`; si absolue mais même origin que `baseUrl` → acceptée; sinon → redirigée vers `baseUrl`.
- Debug: `debug=false` en production (activé seulement hors prod).
- `NEXTAUTH_URL`: en production, doit être défini. Un avertissement est émis au démarrage s'il manque.

### Rate‑limit basique (in‑memory)
- Implémentation: `src/lib/rate-limit.ts` (token bucket, clé = `ip|route`, fenêtre 60s, capacité par défaut 5).
- Appliqué à:
  - `POST /api/users` (signup): capacité 1 req / 60s / IP → 429 si dépassé.
  - `POST /api/auth/resend-verification`: capacité 5 / 60s / IP (réponse générique, 429 si dépassé).
  - `POST /api/profile` (optionnel): capacité 5 / 60s / IP.

## En‑têtes de sécurité & CSP
Configurés via `next.config.ts` → `headers()` en s'appuyant sur `buildSecurityHeaders`.
- CSP minimale (adapter si nécessaire pour SSO/providers):
  - `default-src 'self'`
  - `img-src 'self' data: https:`
  - `script-src 'self' 'unsafe-inline' 'unsafe-eval' https:`
  - `style-src 'self' 'unsafe-inline' https:`
  - `connect-src 'self' https:`
  - `frame-ancestors 'none'`
- Autres en‑têtes:
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `X-Frame-Options: DENY`
  - HSTS en production: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

### Assouplir la CSP (exemples)
- OAuth Google ou LinkedIn: les flux Auth.js passent par des redirections serveur; la CSP ci-dessus est généralement suffisante. Si un provider nécessite des scripts/connexions spécifiques côté client, ajouter les origins requis:
  - Scripts tiers: ajouter l'origin à `script-src` (ex: `https://accounts.google.com`).
  - API webs: ajouter l'origin à `connect-src`.
  - Iframe autorisé (si vraiment nécessaire): remplacer `frame-ancestors 'none'` ou retirer `X-Frame-Options: DENY` pour les pages concernées uniquement.
- Pour ajuster globalement, modifier `src/lib/security-headers.ts`.

## Tests
- Unitaires clés ajoutés:
  - `src/lib/auth/redirect.test.ts`: vérifie le redirect sûr (URL relative, même origin, externe → baseUrl).
  - `src/lib/rate-limit.test.ts`: 10 requêtes < 60s → plusieurs 429 (bucket par défaut 5).
  - `src/lib/security-headers.test.ts`: valide la CSP/headers et HSTS en prod.
- E2E:
  - `tests/e2e/security-auth.spec.ts`: vérifie qu'une tentative de callbackUrl externe retombe sur `baseURL` et que les en‑têtes de sécurité sont présents sur `/login`.

### Flux admin seed
```
pnpm admin:ensure  # crée ou met à jour l'utilisateur admin (hash bcrypt)
```
Requiert `ADMIN_SEED_EMAIL` & `ADMIN_SEED_PASSWORD`.

### Vérification d'email (Brevo)
- À l'inscription: token de vérification envoyé par email (hashé en base), expiration 24h, usage unique.
- Renvoi: `POST /api/auth/resend-verification` (réponse 200 générique ou 429 si rate‑limit).

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
- `pnpm dev`
- `pnpm build` / `pnpm start`
- `pnpm admin:ensure`
- `pnpm db:*`
- `pnpm lint`, `pnpm typecheck`
- `pnpm test` (unit) • `pnpm test:e2e` (Playwright)

## Sécurité / Bonnes pratiques
- Bcrypt cost 10 – Next.js runtime Node pour les routes bcrypt
- JWT signé via `AUTH_SECRET`
- En‑têtes de sécurité & CSP minimale (voir plus haut)

## Changements récents (PR)
- L3: Sécurisation auth (redirect sûr, rate‑limit, headers)
  - Redirect callback NextAuth sécurisé
  - Rate‑limit token bucket commun (signup, resend-verification, profile)
  - CSP/headers par défaut renforcés
