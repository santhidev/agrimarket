import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the workspace packages to be transpiled by Next.js (they ship as TS).
  transpilePackages: ["@agrimarket/database", "@agrimarket/shared"],
};

export default nextConfig;
