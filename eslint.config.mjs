import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // 设计规范检查（详见 docs/design-system.md）。warn 级别：提示违规但不阻塞 build。
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/text-\\[[0-9.]+(px|rem)\\]/]",
          message:
            "禁止任意值字号（text-[..px]）。用刻度内字号：text-xs/sm/base/lg/2xl/3xl（见 docs/design-system.md）。",
        },
        {
          selector: "Literal[value=/\\btext-(xl|4xl|5xl|6xl|7xl|8xl|9xl)\\b/]",
          message:
            "刻度外字号（该类已从 theme 移除，写了不生效）。六级刻度：text-xs/sm/base/lg/2xl/3xl；营销页展示字号用 text-display / text-display-lg。见 docs/design-system.md。",
        },
        {
          selector:
            'JSXOpeningElement[name.name="Text"] > JSXAttribute[name.name="className"] Literal[value=/(\\btext-(xs|sm|base|lg|2xl|3xl|display|display-lg)\\b|\\bfont-(thin|light|normal|medium|semibold|bold|black)\\b|\\bleading-|\\btracking-|\\btext-(foreground|muted-foreground|destructive|success|warning)\\b)/]',
          message:
            "Text 的 className 只放布局类；字号/字重/行高/颜色/字距走 variant/tone/fontWeight props（见 docs/design-system.md）。",
        },
      ],
    },
  },
  // 禁止绕过 components/ui 直接使用 Radix 原始组件
  {
    files: ["app/**/*.tsx", "components/**/*.tsx"],
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@radix-ui/*"],
              message:
                "不要直接 import Radix 原始包，使用 components/ui/ 里的封装组件。",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
