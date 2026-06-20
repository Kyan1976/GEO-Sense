import type { NextConfig } from "next";
import createMDX from "@next/mdx";

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  // standalone: 生成自包含 server.js，服务器部署无需 npm install
  output: "standalone",
  turbopack: {
    root: ".",
  },
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
