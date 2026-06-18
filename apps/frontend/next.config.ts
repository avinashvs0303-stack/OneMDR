import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Strict mode to catch subtle React bugs early
  reactStrictMode: true,

  // Transpile workspace packages (they ship TS source, not compiled JS)
  transpilePackages: ['@onemdr/shared'],

  // ESLint is run separately in CI — skip during `next build` to avoid
  // false failures when the root flat config lacks eslint-config-next.
  eslint: { ignoreDuringBuilds: true },

  // Security headers — supplement to Helmet on the API side
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // Image optimization — add your CDN domain here when deploying
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google OAuth avatars
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
    ],
  },
};

export default nextConfig;
