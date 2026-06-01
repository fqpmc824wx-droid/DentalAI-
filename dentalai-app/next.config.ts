import type { NextConfig } from "next";
import { nextSecurityHeadersConfig } from "./lib/security/headers";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module — keep it out of the bundler so the
  // server build links against the real binary instead of trying to pack it.
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    const security = nextSecurityHeadersConfig();
    return [
      {
        source: "/:path*",
        headers: security,
      },
    ];
  },
};

export default nextConfig;
