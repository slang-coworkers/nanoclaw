---
title: "A recurring defect whose fix keeps failing may have been fixed at the wrong mechanism — clearing-before-run cannot defeat concurrent sharing"
type: learning
topic: misc
source: learnings/1785868290560-a-recurring-defect-whose-fix-keeps-failing-may-hav.md
---

# A recurring defect whose fix keeps failing may have been fixed at the wrong mechanism — clearing-before-run cannot defeat concurrent sharing

Source-verified 2026-08-04 in `slang-pr-review-runner/scripts/compose-and-run.sh` while investigating the 5th+ occurrence of a wrong-PR review.

## What happened

The review pipeline stages diff artifacts at a **shared** path (`$REPO_ROOT/tmp/pr-diff.patch`, plus `pr-files.txt` and `context.json`). Concurrent review runs clobber each other, producing both `INTEGRITY-FAIL` false positives and — worse — subagents silently reviewing a *different* PR.

An earlier instance of this exact class (**PR #11455 reviewed as #11443**) had already been "fixed": the script now does `rm -f "$REPO_ROOT/tmp/pr-diff.patch" …` before each run, with an in-code comment reasoning that "the worst case is an empty read that falls back to a live `gh pr diff`, **never a wrong diff**."

## The load-bearing lesson

⭐⭐⭐**That fix targets SEQUENTIAL staleness (a leftover file from a prior run) and is structurally incapable of defeating CONCURRENT clobber** — a pre-run `rm` does nothing about a *sibling run* writing the shared path while this run is in flight.

So the recurrence to 5+ occurrences was not bad luck or an insufficiently strict guard. **The mitigation addressed the wrong mechanism**: the defect is *sharing*, and the fix addressed *staleness*. No amount of making the pre-run clear more thorough would have helped. And the in-code comment's confident "never a wrong diff" was falsified by a later run doing exactly that.

**Apply:** when a fix for a recurring defect keeps failing, **before making the existing guard stricter or noisier, check whether it targets the right mechanism at all.** Ask: *what class of cause does this mitigation actually foreclose, and is that the class I'm seeing?* A mitigation that forecloses class A will never converge on a class-B cause, however many rounds you harden it. Here the right layer is per-run isolation (stage under the already-existing per-run `$RUN_DIR`), which removes both failure modes at once.

**Two corollaries from the same read:**
- **A confident claim in a code comment is a claim, and it can be falsified by later behavior.** "never a wrong diff" was load-bearing for whoever read it next and had stopped being true.
- **Check the full blast radius, not the one named file.** The reviewer who found this named `pr-diff.patch`; the source read showed `pr-files.txt` and `context.json` share identical exposure. A fix moving only the named file leaves two artifacts clobberable — and would read as "fixed."
- **The guard is conditional on the file existing** (`if [ -f … ]`), so when the artifact is never materialized the integrity check silently does not run — no-coverage, not a pass.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785868290560-a-recurring-defect-whose-fix-keeps-failing-may-hav.md`_
