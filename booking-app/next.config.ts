import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: __dirname,
  },
  // Prisma 的生成产物在 lib/generated/prisma(自定义 output,不在 node_modules 下),
  // standalone 构建的文件追踪默认不会带上它,不显式声明的话生产环境会直接
  // Cannot find module(本地已实测确认过,.next/standalone 里完全没有 prisma 相关文件)。
  outputFileTracingIncludes: {
    "/**": ["./lib/generated/prisma/**/*"],
  },
};

export default nextConfig;
