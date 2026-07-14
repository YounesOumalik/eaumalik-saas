# EAUMALIK SARL — Plateforme SaaS

Plateforme e-commerce + CRM + admin pour **EAUMALIK SARL** (solutions de traitement et purification de l'eau au Maroc).

## Stack

| Couche       | Tech |
|--------------|------|
| Front + Back | Next.js 14 (App Router) + TypeScript |
| UI           | Tailwind CSS + composants maison (style shadcn) |
| BDD          | Supabase / PostgreSQL (PostgREST + RLS) |
| Auth         | Supabase Auth (email + session) + login dev/mock |
| Charts       | Chart.js (chargement dynamique côté client) |
| PDF          | pdfkit (génération facture) |
| Icons        | lucide-react + Font Awesome |
| Fonts        | Outfit (display) + Space Grotesk (body) |

## Démarrage rapide

```bash
cd eaumalik-saas
cp .env.local.example .env.local    # Renseigner l'URL + clé Supabase
npm install
npm run dev                         # http://localhost:3000
```

> **Sans Supabase** : laisser `NEXT_PUBLIC_USE_MOCKS=true` (défaut). L'app fonctionne alors avec les mocks de `src/data/mock.ts`.

## Structure

```
eaumalik-saas/
├── src/
│   ├── app/                              # Routes Next.js 14 (App Router)
│   │   ├── layout.tsx                    # Polices, providers, navbar, footer
│   │   ├── page.tsx                      # Landing
│   │   ├── boutique/page.tsx             # Catalogue produits (filtres + recherche)
│   │   ├── panier/page.tsx               # Panier + checkout
│   │   ├── admin/                        # /admin, /admin/stocks, ...
│   │   ├── crm/                          # /crm (maintenance), /crm/clients
│   │   ├── login/page.tsx                # Connexion (Supabase Auth / dev mock)
│   │   └── api/
│   │       ├── auth/dev-login/           # Auth dev/mock (mode mocks uniquement)
│   │       ├── orders/, [id]/            # POST create, GET list, PATCH status
│   │       ├── products/, [id]/stock/    # GET catalogue, PATCH stock delta
│   │       ├── maintenance/[id]/         # PATCH statut alerte
│   │       └── invoice/                  # GET facture PDF
│   ├── components/
│   │   ├── shared/                       # Navbar, Footer, Providers, Cart, Toast, Theme
│   │   ├── landing/                      # Hero, Features, ProductsPreview, Testimonials
│   │   ├── boutique/                     # ProductCard, AddToCartButton, CategoryFilters
│   │   ├── admin/                        # OrdersTable, StockTable, CatalogueManager, ...
│   │   └── crm/                          # ClientList, MaintenanceAlerts
│   ├── data/
│   │   ├── repositories.ts               # Abstraction Supabase ↔ mocks (point d'entrée unique)
│   │   ├── localDb.ts                    # Lecture/écriture JSON FS (mode mock uniquement)
│   │   └── mock.ts                       # Données seed (catalogue, commandes, clients...)
│   ├── lib/
│   │   ├── utils.ts                      # cn(), formatCurrency, daysUntil, ...
│   │   └── supabase/                     # client.ts, server.ts, middleware.ts
│   ├── types/index.ts                    # Product, Order, User, MaintenanceAlert, ...
│   ├── theme.ts                          # Palette + constantes société
│   └── middleware.ts                     # Refresh session Supabase
├── supabase/
│   ├── schema.sql                        # Schéma complet + RLS policies
│   └── seed.sql                          # 8 produits démo + profil société
├── tailwind.config.ts
├── next.config.mjs
├── tsconfig.json
├── components.json                       # Config shadcn/ui
├── package.json
└── .env.local.example
```

## Schéma SQL

Voir [supabase/schema.sql](../eaumalik-saas/supabase/schema.sql).

Tables : `company_profile`, `users`, `products`, `orders`, `order_items`, `maintenance_alerts`.

### Politiques RLS clés
- `products` : lecture publique, écriture admin
- `orders` : lecture user_id = auth.uid() OU admin
- `maintenance_alerts` : lecture user_id = auth.uid() OU admin

### Rôle admin dans les policies RLS

Les policies RLS utilisent la fonction `eaumalik.is_admin()` (définie dans `supabase/schema-eaumalik.sql` et `supabase/security-hardening.sql`), qui lit `eaumalik.users.role`. Aucun hook JWT custom n'est requis : `is_admin()` est la source de vérité côté SQL (contrairement à `auth.jwt() ->> 'role'` qui ne fonctionne pas sans custom claims).

## Scripts

| Commande           | Effet                                     |
|--------------------|-------------------------------------------|
| `npm run dev`      | Serveur dev (hot reload) sur :3000        |
| `npm run build`    | Build prod                                |
| `npm run start`    | Lance le build                            |
| `npm run lint`     | ESLint                                    |
| `npm run typecheck`| Vérification TypeScript                   |

## Variables d'environnement

| Var                                  | Description                              |
|--------------------------------------|------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`           | URL du projet Supabase                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Anon key                                 |
| `SUPABASE_SERVICE_ROLE_KEY`          | Service role (admin, BYPASS RLS)         |
| `NEXT_PUBLIC_USE_MOCKS`              | `true` = pas besoin de Supabase          || `CAPTCHA_SECRET`                   | Secret HMAC du CAPTCHA maison (obligatoire en prod, `openssl rand -hex 32`) |
## Pages

| Route                       | Description                                |
|-----------------------------|--------------------------------------------|
| `/`                         | Landing page                               |
| `/boutique`                 | Catalogue + filtres + recherche            |
| `/panier`                   | Panier + checkout                          |
| `/login`                    | Connexion email + mot de passe (CAPTCHA maison) |
| `/admin`                    | Tableau de bord admin (commandes)          |
| `/admin/stocks`             | Gestion des stocks                         |
| `/admin/catalogue`          | CRUD produ(Supabase Auth / dev mock)       |
| `/admin/comptabilite`       | KPIs + graphique revenus mensuels          |
| `/crm`                      | Alertes maintenance filtres                |
| `/crm/clients`              | Fiches clients (NPS, total dépensé...)     |

## API

| Méthode + URL                                | Effet                              |
|----------------------------------------------|------------------------------------|
| `GET /api/products?category=...`             | Lister produits                    |
| `PATCH /api/products/{id}/stock`             | `{ delta: int }`                   |
| `GET /api/orders`                            | Lister toutes les commandes        |
| `POST /api/orders`                           | `{ client_*, items: [...] }`       |
| `PATCH /api/orders/{id}`                     | `{ status: '...' }`                |
| `PATCH /api/maintenance/{id}`                | `{ status: '...' }`                |
| `GET /api/invoice?order_id=xxx`              | Télécharge le PDF                  |
| `POST /api/auth/dev-login`                   | Auth dev/mock (mocks uniquement)     |
| `GET /api/auth/captcha`                      | SVG CAPTCHA maison (cookie signé)    |
| `POST /api/auth/sign-up`                     | Inscription Supabase + validation CAPTCHA |
| `POST /api/auth/sign-in`                     | Connexion Supabase + validation CAPTCHA |
| `POST /api/auth/forgot-password`             | Demande reset mdp (CAPTCHA, message générique) |
| `POST /api/auth/reset-password`              | Reset mdp (mode mock, token + CAPTCHA) |

Toutes les routes valident les entrées avec **Zod**.
## Sécurité

- Middleware refresh de session Supabase automatique (`src/middleware.ts`)
- RLS policies strictes (lecture user-scoped + admin)
- Validation serveur côté API (Zod)
- Pas de clés API ou secrets commités (`.env.local.example`)
- Validation téléphone marocain (`/^0[6-7][0-9]{8}$/`)
- `transform: none` sur les cards admin pour neutraliser le hover-transform qui pourrait masquer les `position: relative`

## Design

Palette extraite du logo :

- **Primary** `#0891b2` (cyan-700) → `#22d3ee` (light), `#0e7490` (dark)
- **Backgrounds** `#020617` (bg) → `#0a0f1e` (surface)
- **Text** `#f0f9ff` (principal) → `#7dd3fc` (secondaire) → `#64748b` (muted)

Toutes les variables CSS sont dans `src/app/globals.css` + dupliquées dans `tailwind.config.ts`.

## TODO production
- [ ] Brancher un vrai service d'envoi email (SMTP Resend / SendGrid)
- [ ] Cron job quotidien pour passer les alertes à `expire` automatiquement
- [ ] Webhook paiement (CMI / Stripe Maroc)
- [ ] Upload images vers Supabase Storage (au lieu de picsum.photos)
- [ ] Emails transactionnels (confirmation commande, rappel filtre)
- [ ] Tests E2E (Playwright)
- [ ] Déploiement prod (Contabo/SmartServeur, Docker) — voir `eaumalik-saas/docs/DEPLOY.md`
