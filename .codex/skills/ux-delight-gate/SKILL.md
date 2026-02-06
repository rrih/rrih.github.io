---
name: ux-delight-gate
description: Use after implementing UI for the achievement-tree app to evaluate and iterate for maximum comfort, speed, and delight.
metadata:
  short-description: UX/human-factors quality gate.
---

# What to do
Run a UX quality pass and propose concrete changes, then implement them.

# Checklist (must cover all)
1) Cognitive load
- Can a first-time user add a root node within 3 seconds without reading?
- Are primary actions visually obvious (affordance)? If not, fix.
- Is there any "form-like" friction that can become inline?

2) Motor ergonomics
- Are click targets large enough? (>= 40px touch-friendly)
- Is the most frequent interaction near the focal area, not in corners?
- Does zoom/pan feel controllable (no nausea, no overshoot)?

3) Feedback & emotion
- Every action gives immediate feedback within 100ms.
- Add/done transitions are satisfying, not distracting.
- The URL capacity meter feels like an instrument: readable at a glance.

4) Error recovery
- Undo/redo works for all destructive edits.
- Over-limit state provides friendly rescue actions (“shrink suggestions”), not dead ends.

# Output format
- List top 10 UX issues (prioritized), each with a measurable fix.
- Implement top 3–5 fixes immediately.
