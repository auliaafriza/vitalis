import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Point Turbopack at the monorepo root. Without this it infers the root
   * from the nearest lockfile and refuses to compile the shared packages,
   * which live one level up.
   */
  turbopack: {
    root: path.join(import.meta.dirname, '..', '..'),
  },

  /**
   * The shared packages ship TypeScript source rather than a build step.
   * transpilePackages lets Next compile them in place, which keeps the
   * monorepo free of a watch-and-rebuild loop during development.
   */
  transpilePackages: ['@calorya/core', '@calorya/api'],

  async headers() {
    return [
      {
        // The service worker must never be cached, or users get stuck on an
        // old shell after a deploy.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
