import path from 'node:path';
import type { NextConfig } from 'next';

/** Monorepo root (pnpm workspace): two levels above apps/store. */
const workspaceRoot = path.join(__dirname, '..', '..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // @nait/db ships TypeScript sources; its database drivers stay native Node.js modules.
  transpilePackages: ['@nait/db'],
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],

  // Resolve and trace workspace packages that live outside apps/store.
  outputFileTracingRoot: workspaceRoot,
  turbopack: { root: workspaceRoot },

  async headers() {
    return [
      {
        source: '/media/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=2592000, stale-while-revalidate=604800' }],
      },
    ];
  },
};

export default nextConfig;
