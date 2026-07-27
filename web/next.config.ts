import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
