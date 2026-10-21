import path from "node:path";
import type { NextConfig } from "next";

const backend = process.env.BACKEND_URL ?? "http://127.0.0.1:4100";

const nextConfig: NextConfig = {
  // The shared package ships as TypeScript source.
  transpilePackages: ["@peterhouse/shared"],
  poweredByHeader: false,
  // In production nginx sends /api straight to the backend; in development this does the same job,
  // so the browser only ever talks to one origin and the login cookie just works.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  output: "standalone",
  // In the npm-workspaces monorepo the standalone trace must start at the repo root so the shared package is included.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
};

export default nextConfig;
