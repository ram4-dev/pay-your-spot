import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "compassguard.xyz",
        pathname: "/art/**",
      },
    ],
  },
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default nextConfig;
