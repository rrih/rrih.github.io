---
name: achievement-tree-design-system
description: Use when building UI for the achievement-tree app. Enforces a distinctive, zero-base visual + interaction system (NOT generic Codex UI).
metadata:
  short-description: Distinctive UI system for the achievement tree.
---

# Goal
Produce a UI that does NOT look like default agent-generated apps. It must feel like a crafted product.

# Non-negotiables
- No reliance on existing global CSS/Tailwind look. The app UI lives in Shadow DOM and ships its own reset + styles.
- Avoid generic "card + soft shadow + rounded-lg + gray background" patterns unless explicitly justified.
- Use a small, coherent set of primitives with consistent rhythm.

# Visual system (define + follow)
1) Layout rhythm
- Base spacing unit: 8px. Use 8/16/24/32/48… only.
- Typography: define a clear scale (e.g. 12/14/16/20/28/36) and apply intentionally.
- Use high-contrast text by default. Avoid washed-out gray UI.

2) Shape language
- Choose one distinctive shape rule and stick to it:
  - Option: “squircle-ish” nodes + sharp UI chrome
  - Option: “hard-edge” UI + playful node shapes
- Buttons are not default rectangles. Define a signature.

3) Motion language (crucial for delight)
- Micro-interactions are springy and responsive (but not noisy).
- Panning has subtle inertia; zoom anchors to cursor position.
- Node add/edit/done transitions must communicate cause→effect.

4) Color strategy
- Use a limited palette with one accent + one warning + one success.
- URL capacity meter has a memorable, instrument-like look (not a plain progress bar).

# Interaction principles
- Every frequent action is 1–2 steps max: add child, edit title, toggle collapse, mark done.
- Inline edit is default; avoid form-heavy panels.
- Provide keyboard paths: Enter confirm, Esc cancel, Tab add child, Cmd/Ctrl+Z undo.

# Deliverables expectation
Before coding, draft a “UI spec summary” in the response:
- palette tokens
- type scale
- spacing scale
- shape rules
- motion rules (durations + easing/spring)
Then implement to match.
