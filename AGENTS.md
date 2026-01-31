# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: Next.js App Router pages, layouts, and tool routes.
- `src/components`: UI components (grouped by feature such as `layout/`, `tools/`, `ui/`).
- `src/lib`, `src/hooks`, `src/config`: shared utilities, hooks, and site/tool configuration.
- `content/blog`: markdown/MDX content.
- `public`: static assets; `scripts`: build helpers (OG images, sitemap).
- `test`: Bun test suite; `out/` and `.next/` are generated outputs.

## Build, Test, and Development Commands
- `bun dev`: start the dev server on port 3333.
- `bun build`: run OG/sitemap generators, then `next build` for production.
- `bun start`: serve the production build locally.
- `bun test` / `bun test --watch`: run Bun tests.
- `bun run lint`: Biome lint + format (`--write`).
- `bun run format`: Biome formatting only.
- `bun run quality`: typecheck, lint, and build in one pass.
- `bun run dev-check`: mandatory full quality check + cleanup + AI analysis (see `CLAUDE.md`).

## Coding Style & Naming Conventions
- TypeScript + React (Next.js 15). Use 2-space indentation, single quotes, 100-char line width, and semicolons only when needed (Biome-enforced).
- Keep components in `.tsx` and follow local naming patterns; match existing folder conventions for routes and features.
- Tailwind CSS is the default styling approach; prefer utility classes over ad-hoc CSS.

## Testing Guidelines
- Tests use the Bun runner (`bun:test`) and live in `test/` with `*.test.ts` filenames.
- Add/extend tests for new utilities or logic-heavy components; update `test/setup.ts` for global setup when needed.

## Commit & Pull Request Guidelines
- Recent history favors short, lowercase, imperative subjects (e.g., “add script”, “fix style”). Keep messages concise and specific.
- PRs should include: a short summary, tests run, and screenshots for UI changes. Link related issues when available.

## Agent-Specific & Quality Gates
- `CLAUDE.md` is mandatory: run `bun run dev-check` before commits; Husky enforces checks.
- Update `DEVELOPMENT_HISTORY.md` after each session with changes and next steps.
- No emojis in code; use Lucide icons. Keep colors consistent with the homepage palette and design mobile-first.
