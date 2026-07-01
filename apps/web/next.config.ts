import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the workspace packages + InsForge SDK to be transpiled by Next.js.
  transpilePackages: ["@agrimarket/database", "@agrimarket/shared", "@insforge/sdk"],
};

export default nextConfig;
