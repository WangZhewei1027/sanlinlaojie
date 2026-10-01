import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/nextjs-vite";

const config: StorybookConfig = {
  stories: [
    "../stories/**/*.mdx",
    "../{stories,app,components}/**/*.stories.@(ts|tsx)",
  ],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  docs: {
    autodocs: "tag",
  },
  // lib/fonts.ts loads Geist through next/font/local inside the `geist`
  // package, which Vite cannot bundle from node_modules; swap in a stub.
  viteFinal: async (config) => {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string> | undefined),
      "geist/font/sans": fileURLToPath(
        new URL("./mocks/geist-sans.ts", import.meta.url),
      ),
    };
    return config;
  },
};

export default config;
