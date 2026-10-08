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
  // Self-contained server bundle for the Docker image (see Dockerfile).
  output: "standalone",
  // Node-only server deps: keep them out of the bundle (ali-oss lazily requires
  // optional proxy modules that Turbopack cannot resolve; pg has pg-native;
  // undici ships wasm and is used for the model keep-alive agent).
  serverExternalPackages: ["ali-oss", "pg", "nodemailer", "undici"],
  pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
  cacheComponents: true,
  turbopack: {
    root: projectRoot,
  },
};

export default withMDX(nextConfig);
