# Repository Agent Guide

Read `CLAUDE.md` for architecture and safety constraints. Before writing or changing UI, read `docs/design-system.md`, then search existing components and `*.stories.tsx`.

## UI rules

1. Do not edit generated output: `.next/`, `storybook-static/`, `next-env.d.ts`, or `*.tsbuildinfo`.
2. Do not change authentication, permission, route, API, database or iframe-message semantics during UI-system work.
3. New public/shared components require a Storybook story. Reuse an existing product pattern instead of recreating it in a page.
4. Icon-only controls require an accessible name.
5. Storybook is for display and UI documentation only. Stories must be props-driven, must not access a real backend, and must not contain credentials.
6. Theme/token changes must update the foundation state stories. Do not add new brand-color literals when a semantic token exists.
7. Do not import Radix directly outside `components/ui/`; follow the Text and three-zone typography rules in `docs/design-system.md`.
8. After UI changes run `npm run typecheck`, `npm run lint`, `npm run build`, and `npm run build-storybook`.

Storybook usage and fixture conventions are documented in `docs/ui/storybook.md`; layer responsibilities are in `docs/ui/architecture.md`.
