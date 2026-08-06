# UI Architecture

The repository uses one UI system: the tokens in `app/globals.css` and `tailwind.config.ts`, the primitives in `components/ui/`, and their named states in `stories/**/*.stories.tsx`. Storybook is the documentation runner for those same assets, not a parallel design system or application route.

## Layers

1. **Foundation** — CSS variables, font loading, Tailwind scales, breakpoints, radius and semantic color. Sources: `app/globals.css`, `tailwind.config.ts`, `lib/fonts.ts`.
2. **Component** — reusable, business-neutral primitives in `components/ui/` and route-neutral shared components in `components/`.
3. **Pattern** — recurring product compositions with a stable purpose, kept near their shared consumers.
4. **Feature** — business-aware UI, hooks and state under `app/<route>/components` and related feature folders.
5. **Page** — routing, data access, permission checks, server/client boundaries, analytics and feature composition under `app/`.

Pages and containers own API calls, authorization decisions, navigation semantics and orchestration. A presentational child should receive data and callbacks through props when that keeps its production API honest. Do not move page-specific behavior into a global component merely to make a story easy.

## Choosing an abstraction

Use an existing `components/ui` primitive directly when its API and appearance already match the product need. Add a product wrapper only when several consumers repeat a meaningful product contract, not to rename Radix or Tailwind props. Search existing components and Storybook stories before creating anything new.

Do not import Radix directly outside `components/ui/`. Follow the typography and semantic-token rules in `docs/design-system.md`.

## Storybook responsibility

Storybook is a display and UI documentation surface. It records component variants, theme impact, typography, responsive boundaries and representative product states. It is not a test runner and does not reproduce application workflows.

Stories must be driven by props and local display state. They must not initialize Supabase, call real services, execute OAuth, or contain credentials.

## Provider boundary

The Storybook preview composes only production-safe presentation context: global CSS tokens, the shared Geist font, light/dark theme selection and zh/en i18n. Next.js route display uses the official Storybook navigation mock. It does not replace production providers or create application auth/state/API environments.

## Protected boundaries

- Never edit `.next/`, `storybook-static/`, `next-env.d.ts` or `*.tsbuildinfo`.
- Treat `package-lock.json` as npm-managed.
- Keep `public/js/viewer/` changes separate: it is a standalone iframe runtime, not React UI.
- Do not change auth, permission, API, database or route semantics as part of component-system work.
