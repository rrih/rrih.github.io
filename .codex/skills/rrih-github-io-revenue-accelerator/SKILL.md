---
name: rrih-github-io-revenue-accelerator
description: Use when operating the rrih.github.io revenue accelerator automation: inspect growth and revenue-accelerator PRs and issues, choose exactly one safe revenue increment under rrih.github.io, implement or classify it, verify, create or merge PRs, comment the control issue, and preserve guardrails for AdSense, regulated calculators, and unrelated changes.
---

# rrih.github.io Revenue Accelerator

## Purpose

Run one bounded revenue-growth increment for `https://rrih.github.io/`, aiming at
50,000 JPY/month AdSense revenue without weakening safety gates.

Use this skill as the workflow contract. The automation prompt may add current
paths or final-response wording, but this skill owns the operating procedure.

## Start Here

1. Work in `/Users/rrih/workspace/rrih.github.io` unless the caller gives a different
   checkout path.
2. If the current shell starts in a generated Codex worktree such as
   `/Users/rrih/.codex/worktrees/...`, immediately switch to the canonical repo path before
   inspecting or editing files. Do not modify generated/detached worktrees for this automation.
3. First run `git status --short --branch` in the canonical repo. Preserve unrelated local
   changes.
4. Read the automation memory file if the caller provides one.
5. Read these repo inputs before choosing work:
   - `AGENTS.md`
   - `docs/growth/OPERATIONS.md`
   - `docs/growth/MASTER_PLAN.md`
   - `docs/growth/playbooks/weekly-review.md`
   - `data/growth/accelerator/latest.json`
   - `data/growth/accelerator/latest.md`
   - `data/growth/opportunities.json`
6. Inspect open GitHub PRs labeled `growth` or `revenue-accelerator` before starting
   any repo edit.

## Non-Negotiable Preflight Gate

Run GitHub triage before making any repository change:

```bash
gh auth status
gh pr list --state open --label growth --json number,title,url,headRefName,isDraft,mergeStateStatus,statusCheckRollup --limit 20
gh pr list --state open --label revenue-accelerator --json number,title,url,headRefName,isDraft,mergeStateStatus,statusCheckRollup --limit 20
gh issue list --state open --label growth --json number,title,url,updatedAt,labels --limit 20
gh issue list --state open --label revenue-accelerator --json number,title,url,updatedAt,labels --limit 20
```

This gate is mandatory. If current GitHub state cannot be verified, stop immediately:

- Do not edit repo files, docs, scripts, metrics, generated assets, branches, or commits.
- Do not start a new unit of revenue work.
- Record the exact blocker in automation memory and final response.
- A GUI/computer-use fallback may help investigate auth/browser state, but it does not waive
  the requirement to know current open PR/Issue state before repo edits.

## Work Selection

Choose exactly one concrete unit of work:

1. First priority: fix an open growth/revenue PR with failing checks, merge conflicts,
   missing tests, or review comments.
2. If an open draft PR is only waiting for human review, it does not block a low-risk
   unrelated `auto-pr` item.
3. Keep at most three open revenue-growth PRs. If the limit is reached, fix/close/comment
   instead of creating a new PR.
4. Otherwise choose the highest safe action from the accelerator plan:
   - `auto-pr`: deterministic existing-page improvements, internal links, low-risk
     calculator/tool improvements. May create and merge after all guardrails pass.
   - `draft-pr`: calculation-heavy, tax, labor, finance, public-benefit, legal-policy,
     or regulated tools. Create/update a draft PR only; do not auto-merge.
   - `issue-only`: account setup, missing evidence, unverifiable sources, risky policy
     decisions, or anything requiring human approval.

Do not combine unrelated units. One run may create, update, merge, or classify at most
one unit of work.

## Hard Guardrails

- Stay under `https://rrih.github.io/`; do not introduce other production domains.
- Do not change AdSense account settings, spend money, change DNS, change secrets, add
  paid APIs, or publish thin AI content.
- New tools must be real usable tools, not landing pages.
- Include focused tests for calculation or logic changes.
- Keep ads at max two units per page and never add ads to thin-content pages.
- For tax, labor, finance, public-benefit, or regulated formulas, verify current official
  or primary sources. If not verified, stop at draft PR or issue-only.
- Do not bypass hooks, force-push, or use destructive git commands.
- Update local `DEVELOPMENT_HISTORY.md` when the repo convention requires it, even if it
  is ignored by git.

## Implementation Pattern

For a tool/calculator:

1. Put deterministic calculation logic in `src/lib/` when practical.
2. Add Bun tests in `test/*.test.ts` for normal, edge, and normalization behavior.
3. Add the tool route under `src/app/tools/<tool-id>/`.
4. Register the tool in `src/config/tools.tsx`.
5. Register locale tool routing in `src/app/[locale]/tools/[tool]/page.tsx`.
6. Add related-tool links when there is a clear adjacent workflow.
7. Run build generators through the normal build, allowing required generated assets such
   as OG image, sitemap, and service worker changes.

For existing-page or internal-link work, keep edits narrow and avoid changing ad density
unless the selected action is explicitly ad optimization.

## Verification

When repo files changed, run and report:

```bash
bun test
bun --bun tsc --noEmit
bun run lint
bun run build
```

Also run `bun run dev-check` before committing when feasible. If it fails only at the
final dev-server startup, separate that from successful type/lint/test/build evidence and
record the exact error.

For frontend UI changes, attempt browser verification. If Browser/Playwright is unavailable
and the caller asks for computer use, use CuaDriver without stealing foreground. If GUI
verification is still inconclusive, say so; do not invent visual proof.

## PR, Merge, And Issue Reporting

Before opening a PR, confirm the open growth/revenue PR count and blockers.

For `auto-pr` work:

1. Create a branch with a concise `codex/...` name.
2. Commit normally and let hooks run.
3. Push and open a PR labeled `growth` and `revenue-accelerator` when those labels exist.
4. Include selected action, expected KPI impact, data rationale, and verification in the PR body.
5. Comment the relevant GitHub control issue, usually `Revenue accelerator control tower`.
6. If CI passes and the PR is clean, merge only for low-risk `auto-pr` work.
7. After merge, confirm main CI and deploy status when available.

For `draft-pr` work, keep the PR draft or explicitly unmerged. For `issue-only` work, comment
the issue and do not create a code PR.

## Self-Improvement

If the same ambiguity or blocker recurs, make a narrow update to this skill, the automation
prompt, or the repo workflow docs instead of loosening safety gates.

During a normal revenue run, self-improvement must not bypass the preflight gate. If GitHub
triage is unavailable, update only automation memory and final reporting. Change this skill,
the automation prompt, or repo docs only when the user explicitly asks to improve the automation
itself, or when GitHub triage has succeeded in that run.

Before changing automation prompts or rules, do a static consistency check:

- Target: still 50,000 JPY/month and rrih.github.io only.
- Work selection: still one unit per run and existing broken PRs first.
- Outcomes: `auto-pr`, `draft-pr`, and `issue-only` remain distinct.
- Guardrails: regulated formulas and AdSense/account/DNS/secrets constraints remain hard.
- Reporting: final response and issue comments still distinguish local proof, PR state, deploy
  proof, blockers, and human tasks.

If subagent dispatch is unavailable or not explicitly authorized, write:
`empirical evaluation skipped: dispatch unavailable`.

## Known Failure Patterns

- **Detached-worktree drift**: Codex may launch the automation in
  `/Users/rrih/.codex/worktrees/...` even though the target repo is
  `/Users/rrih/workspace/rrih.github.io`. Always move to the canonical repo before edits.
- **Skill-read but gate-skipped**: Merely reading this skill is not enough. The GitHub triage
  commands must succeed before repo edits.
- **`dev-check` availability drift**: Before reporting `bun run dev-check` as a blocker,
  inspect `package.json` and the referenced script path in the canonical repo. If the script is
  absent, run the four required verification commands and report `dev-check` as unavailable;
  do not ask the user to fix it unless the selected one-unit work is specifically to repair the
  repo's quality gate and GitHub triage has succeeded.
