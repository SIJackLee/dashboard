import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_VERCEL_ENV:
      process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_ENV || "",
  },
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
