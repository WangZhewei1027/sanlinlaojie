# Storybook Guide

Storybook is the project's display and UI documentation environment. It is not configured as a test runner.

## Run and build

```bash
npm ci
npm run storybook
npm run build-storybook
```

Open `http://localhost:6006`. The ignored static output is written to `storybook-static/`.

## Add a story

Create one component-level `*.stories.tsx` under `stories/components/` (or colocated with the component when that is clearer). Set `meta.component` so Autodocs can describe its API, then use typed `Meta`/`StoryObj`, a product-facing title and clear state names. A new public/shared component must include a story.

Use args for simple component props and a focused `render` for compound components. Every named state gets its own Story URL; do not collect variants and states inside an `Overview` wrapper. Keep reusable code inside the CSF file unless the same documentation-only layout is shared by multiple files.

## Presentation context

The preview uses the production global CSS, semantic tokens, Geist font and i18n provider. The toolbar switches between light/dark tokens and zh/en documentation language. Next.js navigation parameters may provide a representative pathname:

```tsx
parameters: {
  nextjs: {
    navigation: { pathname: "/manage" },
  },
}
```

## State and data rules

- Prefer args and props for variants such as default, disabled, loading, empty, error, long content and narrow viewport.
- Stories are documentation examples, not automated tests; do not add `play` test functions or test-runner setup.
- Do not initialize production auth, state stores or API clients merely to render a story.
- Do not access a real backend or include tokens, credentials or customer data.
- If a component cannot render without business infrastructure, document or extract an honest presentational boundary instead of mocking the entire application.
- Stories must not depend on execution order or shared mutable state.

Before handing off a UI change, run:

```bash
npm run typecheck
npm run lint
npm run build
npm run build-storybook
```
