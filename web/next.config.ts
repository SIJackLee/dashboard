import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/admin/health",
        destination: "/admin/ops",
        permanent: false,
      },
      {
        source: "/admin/health/:path*",
        destination: "/admin/ops",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
