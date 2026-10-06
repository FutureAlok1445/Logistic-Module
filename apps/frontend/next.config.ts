import type { NextConfig } from 'next';
import path from 'node:path';
const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: 'standalone',
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  async rewrites() { return [{ source: '/api/v1/:path*', destination: `${process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000'}/api/v1/:path*` }]; },
  async headers() { return [{ source: '/:path*', headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }, { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }] }]; },
};
export default nextConfig;
