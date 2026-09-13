import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/admin",
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
