import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async redirects() {
    return [
      {
        source: "/admin/users",
        destination: "/admin/ops/users",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
