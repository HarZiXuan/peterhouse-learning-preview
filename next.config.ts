import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native and browser-driving packages run on the server only, outside the bundle.
  serverExternalPackages: ["better-sqlite3", "sharp", "puppeteer-core"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
