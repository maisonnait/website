// AUTO-GENERATED from ./drizzle/*.sql by scripts/embed-migrations.ts. Do not edit by hand.
// Regenerate with: pnpm --filter @nait/db db:generate

export interface Migration {
  /** File name of the migration without extension, e.g. "0000_init". */
  id: string;
  /** SQL statements, executed in order inside one transaction. */
  statements: string[];
}

export const migrations: Migration[] = [
  {
    id: "0000_init",
    statements: [
      "CREATE SEQUENCE \"public\".\"order_number_seq\" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;",
      "CREATE TABLE \"collections\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"slug\" text NOT NULL,\n\t\"position\" integer DEFAULT 0 NOT NULL,\n\t\"name_fr\" text NOT NULL,\n\t\"name_en\" text NOT NULL,\n\t\"name_ar\" text NOT NULL,\n\t\"name_ary\" text NOT NULL,\n\t\"name_zgh\" text NOT NULL,\n\t\"description_fr\" text DEFAULT '' NOT NULL,\n\t\"description_en\" text DEFAULT '' NOT NULL,\n\t\"description_ar\" text DEFAULT '' NOT NULL,\n\t\"description_ary\" text DEFAULT '' NOT NULL,\n\t\"description_zgh\" text DEFAULT '' NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"order_items\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"order_id\" uuid NOT NULL,\n\t\"variant_id\" uuid NOT NULL,\n\t\"product_name\" text NOT NULL,\n\t\"scent_name\" text NOT NULL,\n\t\"size_ml\" integer NOT NULL,\n\t\"unit_price_mad\" integer NOT NULL,\n\t\"quantity\" integer NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"order_items_quantity_check\" CHECK (\"order_items\".\"quantity\" > 0)\n);",
      "CREATE TABLE \"orders\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"number\" text NOT NULL,\n\t\"status\" text DEFAULT 'new' NOT NULL,\n\t\"customer_name\" text NOT NULL,\n\t\"phone\" text NOT NULL,\n\t\"city\" text NOT NULL,\n\t\"address\" text NOT NULL,\n\t\"note\" text,\n\t\"lang\" text DEFAULT 'fr' NOT NULL,\n\t\"subtotal_mad\" integer NOT NULL,\n\t\"shipping_mad\" integer DEFAULT 0 NOT NULL,\n\t\"total_mad\" integer NOT NULL,\n\t\"payment_method\" text DEFAULT 'cod' NOT NULL,\n\t\"internal_note\" text,\n\t\"confirmed_at\" timestamp with time zone,\n\t\"shipped_at\" timestamp with time zone,\n\t\"delivered_at\" timestamp with time zone,\n\t\"cancelled_at\" timestamp with time zone,\n\t\"returned_at\" timestamp with time zone,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"orders_status_check\" CHECK (\"orders\".\"status\" in ('new', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned')),\n\tCONSTRAINT \"orders_total_check\" CHECK (\"orders\".\"total_mad\" = \"orders\".\"subtotal_mad\" + \"orders\".\"shipping_mad\")\n);",
      "CREATE TABLE \"products\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"slug\" text NOT NULL,\n\t\"collection_id\" uuid NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"has_sizes\" boolean DEFAULT true NOT NULL,\n\t\"active\" boolean DEFAULT true NOT NULL,\n\t\"position\" integer DEFAULT 0 NOT NULL,\n\t\"image_url\" text,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"scents\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"product_id\" uuid NOT NULL,\n\t\"name_latin\" text NOT NULL,\n\t\"name_ar\" text,\n\t\"tag\" text,\n\t\"position\" integer DEFAULT 0 NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"scents_tag_check\" CHECK (\"scents\".\"tag\" is null or \"scents\".\"tag\" in ('EXTRA', 'SUPER'))\n);",
      "CREATE TABLE \"settings\" (\n\t\"key\" text PRIMARY KEY NOT NULL,\n\t\"value\" jsonb NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL\n);",
      "CREATE TABLE \"stock_movements\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"variant_id\" uuid NOT NULL,\n\t\"delta\" integer NOT NULL,\n\t\"reason\" text NOT NULL,\n\t\"order_id\" uuid,\n\t\"user_id\" uuid,\n\t\"note\" text,\n\t\"stock_after\" integer,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"stock_movements_reason_check\" CHECK (\"stock_movements\".\"reason\" in ('sale', 'cancel', 'return', 'restock', 'adjust', 'initial'))\n);",
      "CREATE TABLE \"users\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"email\" text NOT NULL,\n\t\"name\" text NOT NULL,\n\t\"role\" text DEFAULT 'staff' NOT NULL,\n\t\"password_hash\" text NOT NULL,\n\t\"active\" boolean DEFAULT true NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"users_role_check\" CHECK (\"users\".\"role\" in ('owner', 'staff'))\n);",
      "CREATE TABLE \"variants\" (\n\t\"id\" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,\n\t\"product_id\" uuid NOT NULL,\n\t\"scent_id\" uuid NOT NULL,\n\t\"size_ml\" integer NOT NULL,\n\t\"sku\" text NOT NULL,\n\t\"price_mad\" integer NOT NULL,\n\t\"stock\" integer DEFAULT 0 NOT NULL,\n\t\"low_stock_threshold\" integer DEFAULT 5 NOT NULL,\n\t\"active\" boolean DEFAULT true NOT NULL,\n\t\"created_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\t\"updated_at\" timestamp with time zone DEFAULT now() NOT NULL,\n\tCONSTRAINT \"variants_size_check\" CHECK (\"variants\".\"size_ml\" in (0, 50, 75, 100)),\n\tCONSTRAINT \"variants_price_check\" CHECK (\"variants\".\"price_mad\" >= 0),\n\tCONSTRAINT \"variants_stock_check\" CHECK (\"variants\".\"stock\" >= 0),\n\tCONSTRAINT \"variants_threshold_check\" CHECK (\"variants\".\"low_stock_threshold\" >= 0)\n);",
      "ALTER TABLE \"order_items\" ADD CONSTRAINT \"order_items_order_id_orders_id_fk\" FOREIGN KEY (\"order_id\") REFERENCES \"public\".\"orders\"(\"id\") ON DELETE cascade ON UPDATE no action;",
      "ALTER TABLE \"order_items\" ADD CONSTRAINT \"order_items_variant_id_variants_id_fk\" FOREIGN KEY (\"variant_id\") REFERENCES \"public\".\"variants\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"products\" ADD CONSTRAINT \"products_collection_id_collections_id_fk\" FOREIGN KEY (\"collection_id\") REFERENCES \"public\".\"collections\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"scents\" ADD CONSTRAINT \"scents_product_id_products_id_fk\" FOREIGN KEY (\"product_id\") REFERENCES \"public\".\"products\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"stock_movements\" ADD CONSTRAINT \"stock_movements_variant_id_variants_id_fk\" FOREIGN KEY (\"variant_id\") REFERENCES \"public\".\"variants\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"stock_movements\" ADD CONSTRAINT \"stock_movements_order_id_orders_id_fk\" FOREIGN KEY (\"order_id\") REFERENCES \"public\".\"orders\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"stock_movements\" ADD CONSTRAINT \"stock_movements_user_id_users_id_fk\" FOREIGN KEY (\"user_id\") REFERENCES \"public\".\"users\"(\"id\") ON DELETE set null ON UPDATE no action;",
      "ALTER TABLE \"variants\" ADD CONSTRAINT \"variants_product_id_products_id_fk\" FOREIGN KEY (\"product_id\") REFERENCES \"public\".\"products\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "ALTER TABLE \"variants\" ADD CONSTRAINT \"variants_scent_id_scents_id_fk\" FOREIGN KEY (\"scent_id\") REFERENCES \"public\".\"scents\"(\"id\") ON DELETE no action ON UPDATE no action;",
      "CREATE UNIQUE INDEX \"collections_slug_key\" ON \"collections\" USING btree (\"slug\");",
      "CREATE INDEX \"order_items_order_idx\" ON \"order_items\" USING btree (\"order_id\");",
      "CREATE INDEX \"order_items_variant_idx\" ON \"order_items\" USING btree (\"variant_id\");",
      "CREATE UNIQUE INDEX \"orders_number_key\" ON \"orders\" USING btree (\"number\");",
      "CREATE INDEX \"orders_status_idx\" ON \"orders\" USING btree (\"status\",\"created_at\");",
      "CREATE INDEX \"orders_created_idx\" ON \"orders\" USING btree (\"created_at\");",
      "CREATE INDEX \"orders_phone_idx\" ON \"orders\" USING btree (\"phone\");",
      "CREATE UNIQUE INDEX \"products_slug_key\" ON \"products\" USING btree (\"slug\");",
      "CREATE INDEX \"products_collection_idx\" ON \"products\" USING btree (\"collection_id\",\"position\");",
      "CREATE INDEX \"scents_product_idx\" ON \"scents\" USING btree (\"product_id\",\"position\");",
      "CREATE INDEX \"stock_movements_variant_idx\" ON \"stock_movements\" USING btree (\"variant_id\",\"created_at\");",
      "CREATE INDEX \"stock_movements_order_idx\" ON \"stock_movements\" USING btree (\"order_id\");",
      "CREATE INDEX \"stock_movements_created_idx\" ON \"stock_movements\" USING btree (\"created_at\");",
      "CREATE UNIQUE INDEX \"users_email_key\" ON \"users\" USING btree (\"email\");",
      "CREATE UNIQUE INDEX \"variants_sku_key\" ON \"variants\" USING btree (\"sku\");",
      "CREATE UNIQUE INDEX \"variants_scent_size_key\" ON \"variants\" USING btree (\"scent_id\",\"size_ml\");",
      "CREATE INDEX \"variants_product_idx\" ON \"variants\" USING btree (\"product_id\");",
    ],
  },
];
