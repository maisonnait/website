# Maison N'Ait platform

One repository (pnpm workspaces), two Next.js apps, one shared database.

| Path | What it is | Local address |
| --- | --- | --- |
| `apps/store` | The public shop: catalogue in five languages (fr, en, ar, ary, zgh), cart, cash-on-delivery orders, order tracking. | http://localhost:3000 |
| `apps/admin` | The stock manager (French): orders, stock and movements, products, users, settings. | http://localhost:3001 |
| `packages/db` | `@nait/db`: database schema (Drizzle ORM), SQL migrations, seed, and every query the two apps use. | |
| `brand` | The brand kit built on the house logo (SVG logos, favicon, app icons, share image), its sources and the 3D scene of the house flacon. See `brand/README.md`. | |

Both apps read and write the same Postgres database through `@nait/db`. An order placed in the shop
reduces the stock that the stock manager shows; a stock change in the manager is what the shop sells.

## Run locally

Requirements: Node.js 22 or later, pnpm 10.

```bash
pnpm install
cp .env.example apps/store/.env.local
cp .env.example apps/admin/.env.local    # then set AUTH_SECRET in it (32 characters or more)
pnpm dev                                 # shop on :3000, stock manager on :3001
```

No database server is needed. While `DATABASE_URL` is empty the data lives in `.data/pglite`
(PGlite, Postgres running inside Node.js). The folder is created on the first request, with the
tables and the seed: 4 collections, 25 products, 383 variants at 199 MAD with 20 units each.

- Sign in to the stock manager locally with `admin@maisonnait.ma` / `nait-local-2026`. This account
  exists only in the local database, and only if `ADMIN_EMAIL` / `ADMIN_PASSWORD` are empty.
- The two apps and a build can use the local database at the same time: it is handed from one
  process to the other on demand.
- `pnpm db:reset` deletes the local database; the next start seeds it again.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Both apps in development mode (`pnpm dev:store`, `pnpm dev:admin` for one). |
| `pnpm build` | Production build of both apps. |
| `pnpm test` | Tests. `pnpm --filter @nait/db test` runs the database tests on a temporary database. |
| `pnpm typecheck` | Type check of every package. |
| `pnpm db:migrate` | Creates or updates the tables and seeds an empty database now, instead of on the first request. Uses `DATABASE_URL` if it is set in the shell, the local database otherwise. |
| `pnpm db:reset` | Deletes the local PGlite database. Never touches a Postgres server. |

## Environment variables

Next.js reads them from `apps/store/.env.local` and `apps/admin/.env.local` locally, and from the
project settings on Vercel. `.env.example` lists them all. Never commit real values.

| Variable | Needed by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | both | Postgres connection string. Empty = local PGlite. Must be the same in both apps. |
| `AUTH_SECRET` | admin | Signs the sessions of the stock manager. At least 32 characters (`openssl rand -base64 32`). |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | admin | Owner account created when the database has no user yet. Password of 8 characters or more. With a Postgres server there is no default: without these two variables no account is created. |
| `NEXT_PUBLIC_SITE_URL` | both | Public address of the shop, no trailing slash. |
| `NEXT_PUBLIC_ADMIN_URL` | both | Public address of the stock manager, no trailing slash. |
| `BLOB_READ_WRITE_TOKEN` | admin, optional | Vercel Blob token for product photo uploads. |
| `FAL_KEY` | optional | Not used yet. |

## Database

- Tables: `collections`, `products`, `scents`, `variants`, `orders`, `order_items`,
  `stock_movements`, `users`, `settings`. The schema is `packages/db/src/schema.ts`.
- The first query of each app applies the pending migrations and seeds what is missing. There is no
  separate migration step, locally or in production.
- To change the schema: edit `schema.ts`, run `pnpm --filter @nait/db db:generate`, commit the new
  file in `packages/db/drizzle/` together with `src/migrations.generated.ts`.
- Stock rules, enforced in `@nait/db` and covered by its tests: an order is one transaction and
  can never sell more than the stock; cancelling or returning an order puts its units back once;
  every stock change is written to `stock_movements`; order numbers run `NA-000001`, `NA-000002`, ...

## Deploy on Vercel

`DEPLOY.md` holds the same procedure written as exact commands, with a check after each step: hand that
file to a coding agent (or follow it yourself) to go from this folder to GitHub and to two working Vercel projects.

Two Vercel projects are created from this one repository, and both are connected to one Postgres
database. Menu names below were checked against the Vercel and Neon documentation in November 2026.

1. **Push the repository** to GitHub, GitLab or Bitbucket.
2. **Create the shop project.** In the Vercel dashboard: **Create New** > **Project**, **Import** the
   repository, click **Edit** next to **Root Directory**, choose `apps/store`, then **Deploy**.
3. **Create the stock manager project.** Same steps with the same repository and Root Directory
   `apps/admin`.

   Leave **Include files outside the root directory in the Build Step** on (the default): both apps
   need `packages/db`. pnpm is detected from `pnpm-lock.yaml`; no install or build command has to
   be set. Set **Node.js Version** to 22.x or later (**Settings** > **Build and Deployment**).
4. **Add the database.** Any Postgres works: put its connection string in `DATABASE_URL` in both
   projects. The usual choice is Neon from the Vercel Marketplace: install the Neon integration,
   create the database in a region close to your customers, and it appears under the **Storage**
   tab. Open **Storage** > the database > **Connect Project** and connect it to the shop project,
   then again to the stock manager project. Each connection adds `DATABASE_URL` (the pooled
   connection string) to that project.
5. **Run the functions next to the database.** New projects run in Washington, D.C. (`iad1`). In
   each project, **Settings** > **Functions** > **Function Regions**, pick the region nearest to the
   database, for example Paris (`cdg1`) or Frankfurt (`fra1`).
6. **Set the other variables** in each project's settings (see the table above): `AUTH_SECRET`,
   `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the stock manager; `NEXT_PUBLIC_SITE_URL` and
   `NEXT_PUBLIC_ADMIN_URL` in both.
7. **Redeploy both projects.** Variables only apply to new deployments. The first request creates
   the tables and the catalogue; the owner account is created by the stock manager, which is the
   project that has `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

The first deployment of each project (steps 2 and 3) builds without a database. Until steps 4 to 7
are done, every page of both apps is replaced by a note that says the database still has to be
connected (`apps/store/src/app/setup`, `apps/admin/src/app/configuration`): the local PGlite database
is for a developer's machine only, never for Vercel.

### Domains, and where the stock manager's subdomain is configured

Each project has its own domains: **Settings** > **Domains** > **Add Existing**.

- Shop project: the main domain, for example `www.example.ma` (and the apex `example.ma`).
- Stock manager project: a subdomain of the same domain, for example `stock.example.ma`. This is
  the only place where that subdomain is chosen. Vercel then shows the CNAME record to create at
  the DNS provider of the domain; use the value shown for that project.

Afterwards set `NEXT_PUBLIC_ADMIN_URL=https://stock.example.ma` and
`NEXT_PUBLIC_SITE_URL=https://www.example.ma` in both projects and redeploy them: `NEXT_PUBLIC_`
values are fixed at build time.

### Product photos

The seeded products keep the photo addresses listed in `packages/db/seed/catalog.json`, which are
served by the YouCan CDN (`cdn.youcan.shop`). They stop working if that store is closed: upload each
photo again from the stock manager (this needs `BLOB_READ_WRITE_TOKEN`) before that happens.

Behind every product photo the shop shows the rendered house flacon of the product's collection
(`apps/store/public/media/flacon/bottle-<collection>.webp`). It is what a visitor sees while a photo
loads, and all they see when a photo is missing. These renderings show the house flacon with its
logo; they are not photographs of the products.
