import { defineConfig } from 'drizzle-kit';

// Only used to GENERATE SQL migrations from src/schema.ts (`pnpm --filter @nait/db db:generate`).
// Migrations are applied at runtime by getDb(), never by drizzle-kit.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
});
