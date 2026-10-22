# UI Architecture

The repository uses one UI system: the tokens in `app/globals.css` and `tailwind.config.ts`, the primitives in `components/ui/`, and the rules in `docs/design-system.md`.

## Layers

1. **Foundation** — CSS variables, font loading, Tailwind scales, breakpoints, radius and semantic color. Sources: `app/globals.css`, `tailwind.config.ts`, `lib/fonts.ts`.
2. **Component** — reusable, business-neutral primitives in `components/ui/` and route-neutral shared components in `components/`.
3. **Pattern** — recurring product compositions with a stable purpose, kept near their shared consumers.
4. **Feature** — business-aware UI, hooks and state under `app/<route>/components` and related feature folders.
5. **Page** — routing, data access, permission checks, server/client boundaries, analytics and feature composition under `app/`.

Pages and containers own API calls, authorization decisions, navigation semantics and orchestration. A presentational child should receive data and callbacks through props when that keeps its production API honest.

## Choosing an abstraction

Use an existing `components/ui` primitive directly when its API and appearance already match the product need. Add a product wrapper only when several consumers repeat a meaningful product contract, not to rename Radix or Tailwind props. Search existing components before creating anything new.

Do not import Radix directly outside `components/ui/`. Follow the typography and semantic-token rules in `docs/design-system.md`.

## Protected boundaries

- Never edit `.next/`, `next-env.d.ts` or `*.tsbuildinfo`.
- Treat `package-lock.json` as npm-managed.
- Keep `public/js/viewer/` changes separate: it is a standalone iframe runtime, not React UI.
- Do not change auth, permission, API, database or route semantics as part of component-system work.
