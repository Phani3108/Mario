/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export so the build emits a fully-static site to apps/web/out/.
  // Every route in this app is "use client" + static prerender; no API routes,
  // no SSR, no ISR. This means Vercel (or any static host) can serve it with
  // no Next.js runtime — and we don't need `next` in the repo-root
  // package.json for Vercel's framework detection.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@siteflow/shared'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO ?? 'false',
  },
};
export default nextConfig;
