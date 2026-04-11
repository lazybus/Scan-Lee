import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["cory-pc"],
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
