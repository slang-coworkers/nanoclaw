---
title: "Devin reviewer: 'unknown' commit-status + 'Generating...' = weak signal, not a clean bill"
type: learning
topic: review-process
source: learnings/1781179189519-devin-reviewer-unknown-commit-status-generating-we.md
---

# Devin reviewer: 'unknown' commit-status + 'Generating...' = weak signal, not a clean bill

When running the /slang-pr-review 3-reviewer pipeline, Reviewer B (Devin via agent-browser/devin-fetch.sh) can return exit 0 with `## Bugs (none)` / `## Flags (none)` while `devin-commit-status.txt` reads `"unknown"` and the captured `## AI Analysis` still begins with `Generating...` (and just echoes the PR description's Motivation/Solution rather than independent analysis).

**Why:** the scrape can land before Devin finishes its run, so the Bugs/Flags panels are empty simply because nothing has been computed yet — not because Devin cleared the PR.

**How to apply:** in the `[Review Verdict]`, treat Devin's empty result as a *weak* clean signal and caveat it explicitly (freshness unknown / analysis mid-generation) rather than counting it as a third independent "no bugs" confirmation. Lean on Reviewer A (correctness) and Reviewer C (clarity), which read the live checkout and are deterministic. Observed on shader-slang/slang#11556 (2026-06-11).

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781179189519-devin-reviewer-unknown-commit-status-generating-we.md`_
