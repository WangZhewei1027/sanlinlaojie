# Repository Agent Guide

Read `CLAUDE.md` for architecture and safety constraints. Before writing or changing UI, read `docs/design-system.md`, then search existing components.

## UI rules

1. Do not edit generated output: `.next/`, `next-env.d.ts`, or `*.tsbuildinfo`.
2. Do not change authentication, permission, route, API, database or iframe-message semantics during UI-system work.
3. Reuse an existing product pattern instead of recreating it in a page.
4. Icon-only controls require an accessible name.
5. Theme/token changes must be checked in affected pages in both light and dark themes. Do not add new brand-color literals when a semantic token exists.
6. Do not import Radix directly outside `components/ui/`; follow the Text and three-zone typography rules in `docs/design-system.md`.
7. After UI changes run `npm run typecheck`, `npm run lint`, and `npm run build`.

Layer responsibilities are documented in `docs/ui/architecture.md`.
