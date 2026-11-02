import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Every page in this app reads the session cookie, so nothing is cacheable at
   * build time. Cache Components (and the `partialPrefetching` flag that depends
   * on it) is therefore left off: enabling it would only add Suspense boundaries
   * around data that is dynamic by definition.
   */

  serverExternalPackages: ["@node-rs/argon2", "nodemailer"],

  // argon2 and the pg driver are native modules; keep them out of the bundler.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            // The app ships no third-party scripts; lock that in so a future
            // dependency cannot silently introduce an injection path.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              // Mailpit is reached over plain HTTP on localhost only.
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
