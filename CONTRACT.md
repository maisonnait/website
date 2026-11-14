# Maison N'Ait platform — shared contract (read fully before coding)

Monorepo at /home/claude/platform, pnpm workspaces, Node 22, TypeScript, deploy target Vercel (two projects).

    apps/store    Next.js (latest stable, App Router) — public shop, port 3000        owner: agent STORE
    apps/admin    Next.js (latest stable, App Router) — stock manager, port 3001     owner: agent ADMIN
    packages/db   Drizzle ORM schema + queries + seed, package name @nait/db         owner: agent DATA
    package.json, pnpm-workspace.yaml, .gitignore, .env.example, README.md           owner: agent DATA

Each agent writes ONLY inside the folders it owns. No git commands. No secrets in files.

## Rules that hold everywhere
- The shop sells directly: no link to YouCan anywhere. Payment: cash on delivery only (field kept open for card later).
- Money: integer Moroccan dirhams (MAD). All catalogue prices start at 199.
- Languages of the shop: fr (default), en, ar (rtl), ary = Darija (rtl), zgh = Tamazight in Tifinagh (ltr). Admin: French only.
- Brand look: white #FFFFFF, black #0B0B0C, gold #C9A227 (text gold on white #86650F); light theme by default, dark theme optional.
  Fonts: Josefin Sans (display/UI latin), Spectral (body latin), Reem Kufi + Tajawal + Noto Naskh Arabic (arabic), Noto Sans Tifinagh.
- No dependency on a UI kit. Plain CSS (CSS modules or one global sheet) with CSS variables. No Tailwind.
- Must build with `pnpm -r build` and run locally WITHOUT any external service (no network at runtime).
- Existing material to reuse (read-only): /home/claude/src/i18n.json (texts in 5 languages), /home/claude/src/styles.css (design tokens,
  look), /home/claude/src/page.html + app.js (current one-page site), /home/claude/src/catalog.json (25 products, scents, photo URLs),
  /home/claude/site/media/* (hero, film in 3 language cuts, amber loop: copy into apps/store/public/media), /home/claude/src/glyphs.json.

## Database (packages/db) — Postgres
Driver: `postgres` (postgres.js) when DATABASE_URL is set; otherwise PGlite (@electric-sql/pglite) stored in
`<repo>/.data/pglite` so everything runs locally with no server. Same Drizzle schema for both.
`getDb()` returns a singleton and, on first use, applies migrations and seeds an EMPTY database (25 products from catalog.json,
every variant with stock 20, one owner user from ADMIN_EMAIL / ADMIN_PASSWORD, default settings).

Tables (snake_case columns, uuid ids unless noted, created_at/updated_at timestamps):
- collections(id, slug unique: arabisant|femmes|hommes|unisexe, position, name_fr,name_en,name_ar,name_ary,name_zgh, description_* same 5)
- products(id, slug unique, collection_id, name, has_sizes bool, active bool, position, image_url text null)
- scents(id, product_id, name_latin, name_ar null, tag null: 'EXTRA'|'SUPER', position)   -- a product with no scent gets one scent = its own name
- variants(id, product_id, scent_id, size_ml int (50|75|100, or 0 when the product has no sizes), sku unique, price_mad int,
           stock int >= 0, low_stock_threshold int default 5, active bool)
- orders(id, number unique text like 'NA-000123', status: new|confirmed|shipped|delivered|cancelled|returned, customer_name, phone,
         city, address, note null, lang, subtotal_mad, shipping_mad (0), total_mad, payment_method 'cod', internal_note null,
         confirmed_at, shipped_at, delivered_at, cancelled_at null)
- order_items(id, order_id, variant_id, product_name, scent_name, size_ml, unit_price_mad, quantity)
- stock_movements(id, variant_id, delta int, reason: sale|cancel|return|restock|adjust|initial, order_id null, user_id null, note null)
- users(id, email unique, name, role: owner|staff, password_hash (scrypt), active)
- settings(key text primary key, value jsonb)   -- shipping fee, shop phone, WhatsApp, delivery delay text, announcement

## API exported by @nait/db (exact names; all async; throw `DomainError(code, message)` on business errors)
    getDb()
    // catalogue
    listCollections(): Collection[]
    listProducts(opts?: { collectionSlug?: string; activeOnly?: boolean }): ProductCard[]   // + scentCount, minPrice, inStock
    getProduct(slug): ProductDetail | null            // product + scents + variants (with stock) + collection
    // orders (shop)
    placeOrder(input: { customerName, phone, city, address, note?, lang, items: { variantId, quantity }[] }): { number, total }
        // one transaction: validates phone (Moroccan: 0[5-7]XXXXXXXX or +212[5-7]XXXXXXXX), checks stock with
        // UPDATE ... WHERE stock >= qty, writes order, items and 'sale' movements. Errors: OUT_OF_STOCK, INVALID_PHONE, EMPTY_CART
    getOrderForCustomer(number, phone): OrderSummary | null   // tracking page
    // back office
    listOrders(opts?: { status?, q?, limit?, offset? }), getOrder(id), setOrderStatus(id, status, userId)   // cancel/return put stock back
    updateOrderNote(id, note)
    listVariants(opts?: { q?, lowOnly?, productId? }), adjustStock(variantId, delta, reason, userId, note?)
    listMovements(opts?: { variantId?, limit? })
    upsertProduct(...), setProductActive(id, bool), setVariant(id, { priceMad?, lowStockThreshold?, active? })
    dashboard(): { ordersToday, revenueToday, ordersByStatus, lowStock: Variant[], last7Days: { day, orders, revenue }[] }
    // users
    verifyLogin(email, password): User | null, createUser(...), listUsers(), setUserActive(id, bool)
    getSettings(), setSetting(key, value)
Types are exported from @nait/db. Apps import it as a workspace dependency ("@nait/db": "workspace:*") and must list it in
`transpilePackages` and keep PGlite/postgres in `serverExternalPackages` as needed. DB code runs on the Node runtime only.

## Environment variables (.env.example at the root)
DATABASE_URL (empty = local PGlite), AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_ADMIN_URL,
BLOB_READ_WRITE_TOKEN (optional, photo uploads), FAL_KEY (optional, not used yet)
