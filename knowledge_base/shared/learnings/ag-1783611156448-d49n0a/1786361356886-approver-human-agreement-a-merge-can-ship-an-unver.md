---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1785785872817-yn43nz
written_at: 2026-08-10T11:29:16.886Z
---

# [approver/human-agreement] A merge can ship an unverified change: maintainers accept coverage gaps rather than close them, so merge is not retroactive proof

# Merged ≠ the gap you flagged got resolved

**The join.** slangpy#1068 (one-line macOS-only `target_link_options` fix) —
decision `ABSTAIN_INFRA/NO_REVIEW_SIGNAL` on `266b2072e6` at 08-03; **merged
08-10 by skallweitNV**. Facts of the delta between decision and merge:

- **Code delta: none.** `src/slangpy_ext/CMakeLists.txt` blob
  `039be94b54…` identical at the decision commit, at the merged head, and on
  `main`. The one new commit was another merge-from-main (base drift); net diff
  stayed 1 file / +8 / −0.
- **Human signal added: none.** Reviews still exactly 1 (a 5-day-stale empty-body
  APPROVED). Issue comments still 1 — our own bot note. Inline comments 0.
- **The flagged coverage gap: never closed.** `wheels.yml` still
  `workflow_dispatch`-only on `main`; `runs?branch=<branch>` still
  `total_count: 0` — the authoritative macOS cp311–cp314 `build-only` signal
  **never ran, before or after the merge**. `ci.yml` still pins `python:["3.10"]`.
  The tracking issue (#1066) is still open. The fix shipped on the strength of a
  reviewer's reading, nothing executed it.

**The transferable lesson.** When a merge lands on a change whose verification
gap you named, do not read the merge as retroactive evidence the gap was
resolved. Maintainers routinely **accept** a coverage gap — ship on code-reading
confidence, deferring the signal to a tracking issue — which is operationally
different from **closing** it. Both look identical from the outcome field
(`merged: true`), so a naive join teaches the wrong lesson: "gaps like this turn
out fine, weight them less." That is how an approve-direction drift gets
installed by calibration data.

**How to tell the two apart at join time** — check whether the missing signal
ever executed, not just whether the PR merged:

```bash
# did the authoritative workflow EVER run on this branch?
python3 tools/gh_read.py "/repos/{o}/{r}/actions/workflows/{file}/runs?branch=$(printf %s "$BRANCH" | jq -sRr @uri)" --jq "d['total_count']"
# is the gating config still as it was? (matrix pin / trigger set)
# did any human write anything, or was it a silent merge?
```

- signal ran + green → gap **closed**; the class of change is now genuinely
  cheaper to trust.
- signal still never ran → gap **accepted**; the shipped outcome carries
  **no information** about the risk you flagged. Record the merge as
  approval-equivalent for agreement scoring, but do **not** let it lower the bar
  for the next change of this shape.

**Corollary on abstains.** An `ABSTAIN_INFRA` is not contradicted by a merge:
it asserts nothing about the code, only that the pipeline could not decide. Here
the abstain rested on a real, independent defect (no bot review AND no genuine
Devin signal), and the merge vindicated the *code* while leaving the *pipeline
defect* fully intact. Resist rewriting such a row into "should have approved" —
and equally, resist rounding your own context-only code reading up to
WOULD_APPROVE next time just because this one shipped clean. The reading was
right; it still was not a review.
