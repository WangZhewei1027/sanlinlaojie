import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { webpack as WebpackTypes } from "next/dist/compiled/webpack/webpack";

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
  webpack(config, { dev, isServer, webpack }) {
    if (!dev && !isServer) {
      // Studio ships minified JS. Next 16.0.7's SWC re-minification produces
      // invalid duplicate bindings in its bundled color picker. Isolate only
      // this already-minified dependency; keep normal optimization elsewhere.
      config.optimization.splitChunks.cacheGroups.theatreStudio = {
        test: /[\\/]node_modules[\\/]@theatre[\\/]studio[\\/]/,
        name: "theatre-studio", chunks: "all", enforce: true, priority: 100,
      };
      config.plugins.push({
        apply(compiler: WebpackTypes.Compiler) {
          compiler.hooks.thisCompilation.tap("KeepTheatrePreminified", (compilation: WebpackTypes.Compilation) => {
            compilation.hooks.processAssets.tap({
              name: "KeepTheatrePreminified",
              stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE - 1,
            }, () => {
              for (const name of Object.keys(compilation.assets)) {
                if (/^static\/chunks\/theatre-studio[.-].*\.js$/.test(name)) {
                  compilation.updateAsset(name, compilation.getAsset(name).source, { minimized: true });
                }
              }
            });
          });
        },
      });
    }
    return config;
  },
};

export default withMDX(nextConfig);
