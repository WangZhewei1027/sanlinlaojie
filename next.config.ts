import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const withMDX = createMDX({
  options: {
    // String form required for Turbopack compatibility
    remarkPlugins: [["remark-gfm"]],
  },
});

const nextConfig: NextConfig = {
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  cacheComponents: true,
  turbopack: {
    root: projectRoot,
  },
};

export default withMDX(nextConfig);
