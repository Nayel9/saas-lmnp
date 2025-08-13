# LMNP App (MVP)

## Stack
Next 15 • TS • Tailwind v4 (CLI) • Mantine • Supabase (Auth + PG) • Prisma • pnpm

## Setup
1) Copiez `.env.example` en `.env.local` et renseignez:
    - NEXT_PUBLIC_SUPABASE_URL
    - NEXT_PUBLIC_SUPABASE_ANON_KEY
    - SUPABASE_SERVICE_ROLE_KEY
    - DATABASE_URL
2) Installez et générez:
   ```bash
   pnpm install
   pnpm db:generate
   pnpm db:migrate --name init_lmnp
