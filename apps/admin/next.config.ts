import path from 'node:path'
import type { NextConfig } from 'next'

// The back office must never be indexed, framed or cached by a shared cache.
const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
]

const monorepoRoot = path.join(__dirname, '..', '..')

const nextConfig: NextConfig = {
  // @nait/db ships TypeScript sources; its database drivers stay native Node modules.
  transpilePackages: ['@nait/db'],
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  turbopack: { root: monorepoRoot },
  outputFileTracingRoot: monorepoRoot,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Product photos are sent through a Server Action before going to Vercel Blob.
    serverActions: { bodySizeLimit: '5mb' },
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
