import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it out of the bundler so the
  // server build links against the real binary instead of trying to pack it.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
