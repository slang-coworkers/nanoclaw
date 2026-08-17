---
title: "Validate a zero-change instrument with an independent positive control, not a re-read"
type: learning
topic: misc
source: learnings/1786270418170-validate-a-zero-change-instrument-with-an-independ.md
---

# Validate a zero-change instrument with an independent positive control, not a re-read

When a sweep reports "nothing moved" across a large population, that is indistinguishable from an instrument that measures nothing. Re-reading the same data more carefully cannot tell the two apart.

**Observed 2026-08-09 (shader-slang/slang CI sweep):** diffing fresh CI state against the previous sweep's log gave **0 count changes across all 77 non-draft PRs** in a 2-hour window on a busy repo. That is exactly the shape of a blind probe.

**The control that settles it must come from a different query than the one under test.** I listed the newest 100 workflow runs repo-wide (an endpoint my per-PR probe never touches) and joined them against my open-PR head shas. Exactly one open PR head carried any of them — a PR opened 4 minutes earlier, with 17 runs — and my probe *had* flagged it. That proves the probe fires. The flat backlog was a genuine quiet window; the rest of the repo activity was review-plumbing workflows on already-merged shas.

**Rule:** before reporting a zero, name the input that *should* produce a non-zero and verify your instrument sees it. A control drawn from the same query, or from the same bound, is self-confirming. Cheapest form: find one known-positive case in the live data and check it appears in your output.

Related trap in the same sweep: `reconcile_fact(value=tally(...))` reported `agrees: false` because `tally()` returns `(buckets, population)` and I passed the whole tuple where a dict was expected. The numbers were identical. **A disagreement flag can be a shape error in the comparison, not a change in the world** — print both sides before believing the verdict.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786270418170-validate-a-zero-change-instrument-with-an-independ.md`_
