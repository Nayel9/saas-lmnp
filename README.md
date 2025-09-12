# LMNP App (MVP)

Stack: Next 15 • React 19 • TypeScript (strict) • Tailwind v4 (CLI) • Mantine • Auth.js (NextAuth v5, Credentials) • Prisma • pnpm

## Onboarding (Wizard 3 étapes)

Objectif: rendre un nouvel utilisateur opérationnel en moins de 2 minutes.

Étapes:
1. Créer un bien (Nom, Date début activité par défaut = aujourd'hui, IBAN optionnel, Adresse optionnelle). Champ `vatEnabled` forcé à false par défaut. Retourne `propertyId` et active les étapes suivantes.
2. Ajouter une vente initiale (loyer) liée au bien: Date (par défaut aujourd'hui), Montant TTC, Locataire, Caution ? (switch). Crée une écriture `JournalEntry` type `vente` (compte 706) avec `paymentStatus=PENDING`. Les cautions (`isDeposit=true`) sont exclues des revenus (aligné agrégations existantes).
3. Ajouter une immobilisation: Catégorie (enum `AssetCategory`), Nom, Coût TTC, Date de mise en service, Durée (mois). La durée est pré‑remplie si un `AmortizationDefault` existe pour (bien, catégorie). Création `Asset` (compte 2183 par défaut mobilier) + génération planning linéaire prorata 1er mois (non encore persisté, uniquement renvoyé).

Fin: écran succès avec accès direct Dashboard, Ventes, Immobilisations.

Techniques:
- Multi-tenant: chaque action vérifie l'appartenance du `propertyId`.
- Validation: zod sur chaque étape + routes API `/api/onboarding/{property|sale|asset}`.
- State client typé `{ propertyId?, saleId?, assetId? }`, étapes 2/3 désactivées avant création du bien.
- Pas de `any` / `@ts-ignore`.

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

| Variable                                | Obligatoire          | Rôle                                  |
| --------------------------------------- | -------------------- | ------------------------------------- |
| DATABASE_URL                            | oui                  | Connexion poolée Postgres (runtime).  |
| DIRECT_URL                              | recommandé           | Connexion directe pour Prisma (CLI).  |
| AUTH_SECRET                             | oui                  | Clé JWT/sessions Auth.js v5.          |
| NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL     | dev/local            | URL publique de l'app.                |
| ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD  | optionnel            | Script seed admin.                    |
| S3_BUCKET                               | oui (upload/exports) | Nom du bucket S3 compatible.          |
| S3_REGION ou S3_ENDPOINT                | oui                  | Région AWS ou endpoint S3 compatible. |
| S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY | conseillé            | Credentials d’accès S3.               |
| S3_FORCE_PATH_STYLE                     | optionnel            | 'true' pour compatibilité minio/ceph. |

## Authentification (NextAuth v5 Credentials)

- Provider actif: Credentials (email + mot de passe hashé bcrypt)
- Inscription: `POST /api/users` (zod + bcrypt)
- Session: JWT (`session.user.id`, `role`, `plan`)
- [2025-09-11] Corrections et améliorations UX
  - Fix: Spinner trop grand dans les overlays/modal — limité par dimensions explicites (SubmitButton Spinner)
  - Amélioration: Aperçu pièces jointes (overlay) — taille et message en cas d'absence de pièce
  - Ajout d'une action d'annulation (undo) pour les marquages rapides (toast avec bouton Annuler)
  - Mise à jour README pour la bannière LMNP et la section "À faire"
- [2025-09-11] Paramètres : toggle TVA (par bien)
  - Champ `vatEnabled` sur `Property` (défaut=false)
  - UI `/settings/accounting` avec switch TVA et contrôle d’appartenance
  - UI journaux conditionnelle (HT/TVA/TTC visibles seulement quand ON)
  - Persistance `amountHT`, `vatRate`, `vatAmount`, `amountTTC` (avec `amount=amountTTC`)
  - Limitation MVP: agrégations inchangées (sur `amount` TTC)
- Upload direct: presigned POST (`/api/uploads/presign`)
- Download/preview: URLs signées
- Variables requises: S3_BUCKET et S3_REGION ou S3_ENDPOINT; credentials recommandés
- Mode mock local: storageKey préfixé `mock/` lit depuis `.uploads/`

## Paramètres > TVA (nouveau)

- Cible LMNP: TVA désactivée par défaut (non applicable en général).
- Portée: par bien (Property) via champ `vatEnabled` (boolean, défaut=false).
- Page: `/settings/accounting` → switch “Activer la TVA pour ce bien”.
  - Aide: “LMNP : la TVA est généralement non applicable. Activez uniquement si votre activité le nécessite.”
  - Sauvegarde côté serveur (zod + contrôle d’appartenance du bien).
- Effet UI dans les journaux Achats/Ventes:
  - TVA OFF → l’UI masque les champs HT/TVA; on saisit seulement le Montant TTC (comportement historique).
  - TVA ON → l’UI affiche Montant HT, Taux TVA (%), Montant TVA, Montant TTC avec calculs auto:
    - montantTTC = montantHT × (1 + taux/100)
    - modification de TTC → recalcul HT/TVA (arrondis 2 déc).
- Persistance (Prisma, modèle JournalEntry):
  - Champs optionnels ajoutés: `amountHT?`, `vatRate?`, `vatAmount?`, `amountTTC?`.
  - TVA OFF → on remplit seulement `amount` (≈ TTC) et laisse `amountHT`/`vat*` à null.
  - TVA ON → on remplit `amountHT`, `vatRate`, `vatAmount`, `amountTTC` et on synchronise `amount = amountTTC`.
- Validation (MVP):
  - `vatRate` ∈ [0, 100].
  - Cohérence `amountTTC ≈ amountHT × (1 + rate/100)` (tolérance d’arrondi 2 déc.).
  - Champs requis uniquement quand `vatEnabled=true`.
- Limitation MVP:
  - Les agrégations (Résultat, Bilan, Dashboard, exports) continuent d’utiliser `amount` (TTC). Pas de déclaration TVA.

## Paramètres > Amortissements par défaut (nouveau)

- Fonction: définir des durées d’amortissement par catégorie (mobilier, bâtiment, véhicule) exprimées en mois pour pré-remplir la durée lors de la création d’une immobilisation.
- Portée: par bien (Property). Chaque bien peut définir ses propres valeurs par catégorie.
- Utilisation: dans `/settings/accounting`, section “Durées d’amortissement par défaut”, ajoutez une ligne par catégorie avec la durée (en mois). Lors de la création d’une immobilisation, si vous sélectionnez une catégorie et qu’un défaut existe pour le bien choisi, la durée est pré‑remplie (convertie en années, arrondi au plus proche). L’utilisateur peut toujours modifier la durée avant enregistrement.
- Limitations: le pré‑remplissage est indicatif et reste modifiable au cas par cas; aucune catégorie n’est imposée au modèle Asset (MVP). Unicité par (bien, catégorie).

### API
- `GET /api/settings/amortization-defaults?property=<uuid>` — liste les défauts d’un bien.
- `POST /api/settings/amortization-defaults` — crée un défaut `{ propertyId, category, defaultDurationMonths }` (validation zod, durée > 0, contrôle d’appartenance).
- `PATCH /api/settings/amortization-defaults/:id` — met à jour la durée.
- `DELETE /api/settings/amortization-defaults/:id` — supprime.

### Modèle Prisma
- Enum `AssetCategory` (mobilier, batiment, vehicule)
- Table `amortization_defaults` avec `(propertyId, category)` unique.

### UI
- Section Paramètres → “Durées d’amortissement par défaut” avec table éditable (Catégorie, Durée (mois), Actions), bouton “Ajouter une catégorie”.

### Création d’Immobilisation
- Ajout d’un sélecteur de catégorie (optionnel). Si un défaut existe pour le bien et la catégorie choisis, la durée est pré‑remplie (en années). Toujours modifiable.

## Dashboard

### Cartes clés (mois)

- Sélecteurs: Portée (Utilisateur|Bien), Bien, Mois, Année.
- Montre Encaissements, Dépenses, Résultat du mois + statut “Amortissement du mois”.
- Action: “Poster l’amortissement” (idempotent) crée une ligne d’amortissement mensuelle (note `month:YYYY-MM`).

### À faire (nouveau)

- Carte “À faire” affichant 3 catégories (max 5 items par liste):
  1. Loyers non encaissés: ventes `isDeposit=false` du mois dont le compte n’est pas de trésorerie (≠ 512/53). Bouton “Marquer encaissé” (action serveur) met le compte à `512` (idempotent).
  2. Dépenses sans justificatif: achats du mois sans pièce jointe. Bouton “Ajouter justificatif” redirige vers le journal Achats avec filtre.
  3. Cautions en cours: total + nombre de cautions (`isDeposit=true`) sur la période.
- Endpoint: `GET /api/dashboard/todo?property=<uuid>&year=YYYY&month=MM[&scope=user|property]`
  - Réponse `{ unpaidRents: [{ id, date, amount, tenant }], expensesWithoutDocs: [{ id, date, amount, supplier }], depositsHeld: { count, total } }`
  - Sécurité: vérifie l’appartenance du bien au user (multi-tenant).
- Action serveur: `markRentPaid(entryId)`
  - Règles: uniquement ventes non dépôt du user; met `account_code="512"`; sans effet si déjà 512/53.
- États UI: affiche “Rien à signaler 🎉” si aucune tâche.

### Historique rapide (nouveau)

- Affiche les 5 dernières ventes (hors cautions) et les 5 dernières dépenses, triées par date décroissante.
- UI: carte "Historique rapide" en 2 colonnes (Loyers / Dépenses), chaque ligne montre date, tiers (locataire/fournisseur) et montant, avec lien vers la liste filtrée du journal correspondant.
- Loader: skeleton/Spinner au chargement. Affiche "Aucune donnée" si vide.
- Endpoint: `GET /api/dashboard/history?property=<uuid>&scope=user|property`
  - Réponse:
    - `{ sales: [{ id, date, amount, tenant }], purchases: [{ id, date, amount, supplier }] }`
  - Règles:
    - sales: dernières écritures de type `vente` avec `isDeposit=false`, `orderBy date desc`, `take 5`.
    - purchases: dernières écritures de type `achat`, `orderBy date desc`, `take 5`.
  - Sécurité: contrôle d'appartenance de la propriété (multi-tenant) quand `scope=property`.
- Exemple: Loyers → ligne "12/09/2025 · 650,00 € — Loc B" avec bouton "Ouvrir" qui renvoie vers `/journal/ventes?from=YYYY-MM-DD&to=YYYY-MM-DD&q=<locataire>`.

## Synthèse

### Portée (Utilisateur | Bien)

- Tu peux choisir la portée des agrégations: globale (Utilisateur) ou par Bien.
- UI: sélecteur “Portée” sur Dashboard (mensuel) et Synthèse (Résultat, Bilan).
- API: ajoute `scope=user` (défaut) ou `scope=property` aux endpoints:
  - `/api/dashboard/monthly?property=<uuid>&year=YYYY&month=MM&scope=user|property`
  - `/api/synthesis/income-statement?property=<uuid>&year=YYYY&scope=user|property`
  - `/api/synthesis/balance?property=<uuid>&year=YYYY&scope=user|property`
  - Exports: `/api/synthesis/export/{csv|pdf}?property=<uuid>&year=YYYY&scope=user|property`
- Détails calcul:
  - scope=user: agrège le journal complet (ventes hors cautions, achats) + assets de l’utilisateur.
  - scope=property: agrège par bien (Income/Expense, Amortization liés au bien, assets liés au bien).
  - Note: les écritures du journal et les immobilisations doivent être reliées à un bien (`propertyId`) pour que le mode "Bien" reflète fidèlement tes données.

### Compte de résultat (simple)

- API: `GET /api/synthesis/income-statement?property=<uuid>&year=YYYY[&scope=user|property]`
- Page: `/synthesis?tab=result` (sélecteurs Bien + Année)
- Calcul: Revenus (ventes hors cautions) – Dépenses (achats hors 6811) – Amortissements (6811)

### Bilan (simple)

- API: `GET /api/synthesis/balance?property=<uuid>&year=YYYY[&scope=user|property]`
- Page: `/synthesis?tab=balance` (sélecteurs Bien + Année)
- Calculs:
  - VNC (immobilisations nettes) = Σ (coût – amort cumulé ≤ 31/12)
  - Trésorerie (MVP) = Σ ventes (isDeposit=false) – Σ achats (sur l’année)
  - Cautions détenues = Σ ventes (isDeposit=true) sur l’année (MVP)
  - Autres dettes = 0 (placeholder)
- Retour JSON: `{ actif: { vnc, treso, total }, passif: { cautions, dettes, total }, ecart }`

### Aides LMNP (bannière)

- Message affiché (FR grand public):
  > En LMNP, l’amortissement ne crée pas de déficit global. Si l’“usure” (amortissements) dépasse votre résultat d’exploitation, l’excédent peut être reporté sur les années suivantes.

- Condition d’affichage (warning):
  - EBE = Revenus (hors cautions) – Dépenses (hors amortissements)
  - Si Amortissements > EBE → bannière visible (variant “warning”)
  - Sinon → une icône/info-bulle “ℹ️ LMNP” permet de revoir le message (moins intrusif)

- UX / comportement:
  - Bouton “J’ai compris” masque la bannière pour la combinaison (bien, année)
  - Persistance locale: `localStorage` avec la clé `lmnp_banner_ack:<propertyId>:<year>` (ex. `lmnp_banner_ack:8a7f-2024`)
  - Si la clé est présente, la bannière n’est plus affichée pour cette paire (propertyId, year) ; afficher alors le petit bouton/Popover “ℹ️ LMNP” pour la revoir
  - Accessibilité: rôle="status" et `aria-live="polite"` sur la bannière; contraste suffisant pour le variant warning

- Notes d'implémentation (technique):
  - Composant UI: shadcn/ui `Alert` (variant "warning"), `Button`, `Popover`/`Tooltip` pour l’info
  - Récupération des données: réutiliser l’API d’agrégation utilisée par le Compte de Résultat (pas de duplication)
  - Calcul condition: `shouldShowLmnpBanner({ revenues, expenses, amort }) => amort > (revenues - expenses)`
  - Persistance: lecture/écriture `localStorage` côté client uniquement

- Tests attendus (Vitest):
  1) Unitaires:
     - `shouldShowLmnpBanner` retourne `true` si `amort > (revenues - expenses)`, sinon `false`.
     - Tests de lecture/écriture de `localStorage` (clé `lmnp_banner_ack:<propertyId>:<year>`) via mock.
  2) Intégration (React Testing Library):
     - Cas A (amort > EBE) → la bannière warning s’affiche avec le texte exact.
     - Cas B (amort <= EBE) → seule l’icône/info est affichée.
     - Clic sur “J’ai compris” écrit la clé dans `localStorage` et masque la bannière.
  3) E2E (facultatif, Playwright):
     - Smoke test visite /synthesis, vérifie la bannière pour le cas amort > EBE, clique “J’ai compris” et recharge pour confirmer la persistance.

- Pourquoi cette aide ?
  - Permet d’éviter les erreurs d’interprétation du rôle de l’amortissement en LMNP et d’orienter l’usager vers la notion de report.

### Exports (PDF/CSV)

- UI: depuis la page `/synthesis` (onglet Résultat ou Bilan) → boutons “Exporter PDF” et “Exporter CSV”.
- Endpoints:
  - PDF: `GET /api/synthesis/export/pdf?property=<uuid>&year=YYYY[&scope=user|property]`
  - CSV (ZIP): `GET /api/synthesis/export/csv?property=<uuid>&year=YYYY[&scope=user|property]`
- PDF (A4 portrait):
  - En-tête: nom du bien, année, date d’édition
  - Compte de résultat (4 lignes): Revenus, Dépenses, Amortissements, Résultat
  - Bilan (simple): Actif (VNC, Trésorerie) / Passif (Cautions, Dettes=0)
  - Montants formatés en EUR (locale fr-FR)
- CSV (ZIP):
  - income_statement.csv: colonnes `label,amount` avec lignes `revenues, expenses, depreciation, result`
  - balance_sheet.csv: colonnes `section,label,amount` avec lignes `ASSET,vnc_total`, `ASSET,cash_mvp`, `LIABILITY,deposits_held`, `LIABILITY,payables_placeholder`
  - Encodage UTF‑8, séparateur `,`, décimales `.`

## Scripts

- Dév: `pnpm dev`
- Build: `pnpm build`
- Lint / Types: `pnpm lint`, `pnpm typecheck`
- Tests: `pnpm test` (Vitest), `pnpm test:e2e` (Playwright)
- DB: `pnpm db:*`
- Admin: `pnpm admin:ensure`

## Screens

- Dashboard → `/dashboard` : Cartes clés (mois) et section “À faire”.
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
- [2025-09-09] Synthèse : export PDF/CSV
  - Endpoints `/api/synthesis/export/pdf` et `/api/synthesis/export/csv`
  - UI boutons Export sur Synthèse (PDF/CSV)
  - Tests unitaires + intégration (PDF/ZIP)
- [2025-09-09] Synthèse : bannière LMNP explicative
  - Bannière d’aide affichée si `amortissements > (revenus - dépenses)` (EBE)
  - Bouton “J’ai compris” (persistance locale par bien + année)
  - Icône/info-bulle “ℹ️ LMNP” si la condition n’est pas remplie
- [2025-09-09] Synthèse : sélection de portée (Utilisateur | Bien)
  - UI: sélecteur sur Dashboard et Synthèse (Résultat/Bilan)
  - API: prise en charge du paramètre `scope=user|property` (+ exports CSV/PDF)
  - Schéma Prisma: `propertyId` sur `journal_entries` et `assets` (optionnel)
- [2025-09-11] Dashboard : section “À faire”
  - Endpoint `/api/dashboard/todo` (3 catégories)
  - Action serveur `markRentPaid`
  - UI carte “À faire” (max 5 par liste) + liens vers éditions
  - Tests unitaires + intégration
- [2025-09-11] Dashboard : historique rapide
  - API `/api/dashboard/history` (5 ventes hors cautions + 5 achats, tri desc)
  - UI carte "Historique rapide" (2 colonnes) avec liens vers les journaux
  - Tests unitaires + intégration
- [2025-09-11] Corrections et améliorations UX
  - Fix: Spinner trop grand dans les overlays/modal — limité par dimensions explicites (SubmitButton Spinner)
  - Amélioration: Aperçu pièces jointes (overlay) — taille et message en cas d'absence de pièce
  - Ajout d'une action d'annulation (undo) pour les marquages rapides (toast avec bouton Annuler)
  - Mise à jour README pour la bannière LMNP et la section "À faire"
- [2025-09-11] Paramètres : durées d’amortissement par défaut
  - Enum `AssetCategory` et table `amortization_defaults` (contrainte unique `propertyId+category`)
  - API CRUD `/api/settings/amortization-defaults`
  - UI paramètres (table éditable, ajout/suppression, validation zod)
  - Formulaire Immobilisation: pré-remplissage de la durée si défaut existant (modif possible)
- [2025-09-12] Onboarding : wizard 3 étapes
  - Routes API `/api/onboarding/{property|sale|asset}` (zod + multi-tenant)
  - Champs supplémentaires: `Property.startDate`, `Property.iban`, `JournalEntry.paymentStatus` (enum PaymentStatus)
  - Génération planning amortissement en mémoire après création asset
  - UI client (3 étapes + écran succès)
