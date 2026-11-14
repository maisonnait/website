# Deploying Maison N'Ait: instructions for a coding agent

You are working on the owner's machine, in the folder that contains this file (the repository root: it holds
`package.json`, `pnpm-workspace.yaml`, `apps/`, `packages/`). Your job: put this repository on GitHub and deploy its
two apps on Vercel, connected to one Postgres database. Work through the steps in order. After every step run the
check that is given and do not continue until it passes. Stop and ask the owner whenever a step says so.

Facts you must not get wrong:

- This is ONE repository with TWO Vercel projects. The shop's project has Root Directory `apps/store`, the stock
  manager's has Root Directory `apps/admin`. A project whose Root Directory is the repository root cannot work:
  the build either fails ("No Next.js version detected", "No Output Directory named public") or serves nothing.
- Both projects need the same `DATABASE_URL` (Postgres). Without it each app shows a page titled "il reste à relier
  sa base de données" instead of its content. That page means: connect the database, then redeploy.
- Environment variables only reach deployments created after they were set. After changing any, redeploy.
- Package manager: pnpm (the version in `packageManager` of `package.json`), Node.js 22 or later. Never run `npm install`
  or `yarn` here, and never edit a `package.json` without running `pnpm install` so `pnpm-lock.yaml` follows: Vercel
  installs with a frozen lockfile.
- Never commit `.env*` files, never print secrets in chat, never put a secret in a command that is logged to a file.

## 0. If a deployment already exists and does not load

Before creating anything, look at what is there:

```bash
vercel login                      # once
vercel project ls
vercel api /v9/projects/<project-name>      # look at "rootDirectory", "framework", "link" (the Git repository)
vercel ls <project-name>                    # recent deployments and their state
vercel inspect <deployment-url> --logs      # build log of one deployment
vercel env ls                               # run in a folder linked to the project
```

Typical findings: `rootDirectory` is null or wrong (fix it in step 3), no `DATABASE_URL` (step 4), the repository was
pushed with an extra folder level (then the Root Directories are `<that-folder>/apps/store` and
`<that-folder>/apps/admin`; better: make the folder that contains this file the repository root). Tell the owner what
you found, then either repair the existing projects with the steps below or delete them and start clean; ask which.

## 1. Check the code locally

```bash
node -v                           # v22 or later
corepack enable                   # makes the pnpm version of package.json available; or: npm i -g pnpm@10
pnpm install --frozen-lockfile
pnpm build                        # builds both apps; no database or variable is needed for this
```

Check: both builds end with `Done`. Optional: `pnpm dev`, shop on http://localhost:3000, stock manager on
http://localhost:3001 (local sign-in in `README.md`; locally the data lives in `.data/`, which is not committed).

## 2. Put the repository on GitHub

Ask the owner which GitHub repository to use: a new private one (recommended), or an existing one. Do not push to a
repository that already has other content without asking: this project replaces the earlier static site, it is not an
update of it.

```bash
git init -b main                  # skip if this folder is already a repository
git add -A
git status --short | grep -E "node_modules|\.next/|\.data/|\.env" && echo "STOP: files that must not be committed"
git commit -m "Maison N'Ait: shop, stock manager and shared database"
gh auth status || gh auth login
gh repo create <owner>/<name> --private --source=. --remote=origin --push
```

Check: `git ls-remote origin main` prints a commit, and the repository on GitHub shows `apps/`, `packages/` and
`package.json` at its top level.

## 3. Create the two Vercel projects with their Root Directories

Names below are examples; ask the owner for the names and the Vercel team (scope) to use.

```bash
vercel project add nait-store
vercel project add nait-admin
vercel api /v9/projects/nait-store -X PATCH -F rootDirectory=apps/store -F framework=nextjs
vercel api /v9/projects/nait-admin -X PATCH -F rootDirectory=apps/admin -F framework=nextjs
```

If `vercel api` is not available in the installed CLI, update it (`npm i -g vercel@latest`), or ask the owner to set
**Settings > Build and Deployment > Root Directory** for each project in the Vercel dashboard. Leave "Include files
outside the root directory in the Build Step" enabled (both apps import `packages/db`). No custom install, build or
output setting is needed. Node.js version: 22.x or later.

Connect each project to the GitHub repository (run from the repository root):

```bash
vercel link --yes --project nait-store && vercel git connect
vercel link --yes --project nait-admin && vercel git connect
```

If `vercel git connect` asks for the GitHub app to be installed, the owner has to approve it in the browser.

Check: `vercel api /v9/projects/nait-store` shows `"rootDirectory": "apps/store"` and a `link` to the repository;
the same for `nait-admin` with `apps/admin`.

## 4. Create the Postgres database and connect it to BOTH projects

Recommended: Neon through the Vercel Marketplace, in a European region (for example Frankfurt).

```bash
vercel link --yes --project nait-store
vercel integration add neon                           # creates the database and connects it to the linked project
vercel integration list                               # note the resource name of the new database
vercel integration resource connect <resource-name> nait-admin
```

If the CLI opens the browser to accept the Marketplace terms or to choose the plan and region, the owner completes
that step, then you continue. Dashboard equivalent: project > **Storage** > **Create Database** (Neon), then on the
database **Connect Project** for the second project. Any other Postgres works too: add its connection string as
`DATABASE_URL` in both projects.

Check, for each project (`vercel link --yes --project <name>` first): `vercel env ls` lists `DATABASE_URL` for
Production. Both projects must point at the same database.

Then run the functions next to the database (replace `fra1` by the Vercel region nearest to the database's region):

```bash
vercel api /v9/projects/nait-store -X PATCH -F serverlessFunctionRegion=fra1
vercel api /v9/projects/nait-admin -X PATCH -F serverlessFunctionRegion=fra1
```

## 5. Set the other variables

Ask the owner for the e-mail address of the owner account of the stock manager. Generate the two secrets yourself,
store them only in Vercel, and show the password to the owner once so they can save it in a password manager.

```bash
vercel link --yes --project nait-admin
vercel env add AUTH_SECRET --environment production --sensitive --yes        # paste: output of `openssl rand -base64 32`
vercel env add ADMIN_EMAIL --environment production --yes                    # the owner's e-mail address
vercel env add ADMIN_PASSWORD --environment production --sensitive --yes     # 12 characters or more
```

The public addresses, in BOTH projects (use the real domains once they exist, otherwise the `*.vercel.app` addresses
shown by `vercel project inspect <name>`; no trailing slash):

```bash
vercel env add NEXT_PUBLIC_SITE_URL  --environment production --value "https://<shop-address>"  --yes
vercel env add NEXT_PUBLIC_ADMIN_URL --environment production --value "https://<stock-address>" --yes
```

Optional, stock manager only: `BLOB_READ_WRITE_TOKEN` (Vercel Blob) to upload product photos from the stock manager.

## 6. Deploy

Variables only apply to new deployments, so deploy now:

```bash
git commit --allow-empty -m "Deploy" && git push        # both projects build from the push
vercel ls nait-store
vercel ls nait-admin
```

Wait until the newest deployment of each project is `Ready`; if one is `Error`, read it with
`vercel inspect <deployment-url> --logs` and fix the cause before doing anything else.

## 7. Verify, in this order

1. Shop address: the home page shows the flacon and the collections (not the "relier sa base de données" page).
   The very first request creates the tables and the catalogue and can take several seconds; reload once.
2. `/fr/collections/femmes` lists products; a product page shows scents, sizes and "En stock".
3. Place a test order (cash on delivery, any Moroccan mobile number such as 0612345678). Note the number `NA-...`.
4. Stock manager address: sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`. The order is in **Commandes**; the stock of
   the ordered variant went down by the quantity.
5. Cancel that order in the stock manager: the stock goes back up, and the shop's "Suivre ma commande" page shows it
   as cancelled.

Report the two addresses and the result of each of the five checks to the owner.

## 8. Domains (when the owner is ready)

Shop: the main domain (`www.` and apex) on `nait-store`. Stock manager: a subdomain such as `stock.` on `nait-admin`.
Add them in each project (**Settings > Domains**, or `vercel domains add <domain> <project>`), create the DNS records
Vercel displays, then set `NEXT_PUBLIC_SITE_URL` and `NEXT_PUBLIC_ADMIN_URL` to the final addresses in both projects
(`vercel env rm <NAME> production` then add again) and redeploy.

## Symptoms and causes

| What you see | Cause | Fix |
| --- | --- | --- |
| Build fails: "No Next.js version detected" or "No Output Directory named public" | Root Directory is the repository root | Step 3 |
| Build fails during install with a lockfile error | `package.json` edited without updating `pnpm-lock.yaml`, or npm/yarn was used | `pnpm install`, commit the lockfile |
| Page "il reste à relier sa base de données" | No `DATABASE_URL` in that project, or not redeployed since | Steps 4 and 6 |
| Shop works, stock manager says the configuration is incomplete or sign-in fails | `AUTH_SECRET`, `ADMIN_EMAIL` or `ADMIN_PASSWORD` missing; the owner account is created on the first start that has both | Step 5, then redeploy |
| An order placed in the shop does not appear in the stock manager | The two projects use different databases | Step 4: connect the same database to both |
| First page after a deployment is slow or times out once | Tables and catalogue are being created; functions far from the database | Reload; set the function region (step 4) |
| Vercel asks visitors to log in before showing the site | That address is a preview deployment (Deployment Protection) | Use the production address; deploy to production with a push to `main` |
| Product photos missing | They are still served by the old shop's CDN | Upload them from the stock manager (needs `BLOB_READ_WRITE_TOKEN`) |
