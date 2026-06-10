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

## Growth Automation (AdSense Revenue Program)
This repository runs an automated growth loop targeting 10,000 JPY/month AdSense revenue by 2026-12. Any agent (Codex, Claude Code, or other LLMs) can execute it.

- **Entry point**: open the latest GitHub Issue labeled `growth` ("Weekly growth review ..."), or run `bun scripts/growth/fetch-metrics.ts` to refresh data, then follow `docs/growth/playbooks/weekly-review.md`.
- **Plan & KPIs**: `docs/growth/MASTER_PLAN.md` (monthly targets, tool backlog). Operations and one-time human setup: `docs/growth/OPERATIONS.md`.
- **Playbooks** (deterministic, LLM-agnostic procedures): `docs/growth/playbooks/weekly-review.md`, `seo-content.md`, `ad-optimization.md`.
- **Data**: `data/growth/metrics/latest.json` (GSC + GA4 snapshots), `data/growth/reports/*.md` (weekly reports), `data/growth/revenue.json` (manually recorded AdSense earnings).
- **Ads code**: `src/components/ads/ad-unit.tsx` + `src/config/ads.ts` (slot IDs). Max 2 ad units per page; never place ads on thin-content pages.
- Every growth change must still pass `bun run dev-check` and ship as a PR referencing the weekly issue.
