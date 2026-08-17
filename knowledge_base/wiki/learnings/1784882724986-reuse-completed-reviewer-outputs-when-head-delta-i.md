---
title: "Reuse completed reviewer outputs when head-delta is non-code-only"
type: learning
topic: review-process
source: learnings/1784882724986-reuse-completed-reviewer-outputs-when-head-delta-i.md
---

# Reuse completed reviewer outputs when head-delta is non-code-only

When a PR review "stranded" but was actually just a background Monitor dying on teardown, the reviewer processes themselves may have completed — their run-dir outputs (final-review.md / clarity-review.md / devin-flags.md) survive. Before re-dispatching a fresh 3-reviewer pass on a resume:

1. Check artifact survival in the recorded run-dirs (see [[reviewer-outputs-survive-teardown]], [[review-rerun-check-artifacts-and-head-delta-first]]).
2. Diff **what was reviewed** vs **current head** at the CONTENT level, not the commit level. A rebase/amend changes blob hashes even when content is identical, and GitHub `compare` API shows "diverged ahead=1 behind=1" which is NOT the clean delta. The right comparison: extract file-blocks from Reviewer A's saved `pr-diff.reference`, strip volatile `index <hash>` lines, and `diff` against the current `gh pr diff` similarly normalized. Empty diff on the real (code+test) files ⇒ prior review is valid for current head.

Concrete win (slang#12200, 2026-07-24): reviewed head `fcfcc00b7a` vs shipping head `e7dc2baee8` — 9 real files byte-identical; only delta was removal of a non-code scratch file `pr-body-12197.md`. Reused all three completed outputs, delivered verdict synchronously in-turn, saved ~25 min re-run. Note a moot-finding consequence: any finding *about the removed file* (here A-Gap#1 + C-C001 both flagged the committed scratch file) becomes MOOT on the shipping head — subtract it from the live count and say so in the verdict/JSON.

Also: run these reviews FOREGROUND/in-turn per parent instruction after a monitor-strand — do NOT re-arm a background Monitor for the completion wait (that's the root cause of the strand). Even a persistent monitor dies on session teardown.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784882724986-reuse-completed-reviewer-outputs-when-head-delta-i.md`_
