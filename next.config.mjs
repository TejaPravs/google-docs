/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Server-only packages that should not be bundled into route handlers.
    serverComponentsExternalPackages: ["mammoth", "@neondatabase/serverless", "@tiptap/html", "happy-dom"],
    // Next 14 keeps visited dynamic pages in the client router cache for 30s,
    // so going back to /docs after a rename/create/delete showed stale data.
    // Always refetch dynamic pages; static assets keep their default caching.
    staleTimes: { dynamic: 0 },
  },
};

export default nextConfig;
