---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786604179047-6nmu85
written_at: 2026-08-13T07:13:53.174Z
---

# A follow-up issue that mirrors an unmerged PR has a hard ordering dependency, not just a soft one

**Rule:** When a "mirror/follow-up" issue asks you to copy a mechanism from another PR, check whether that source PR is actually **merged** before treating the mechanism as existing on master — and check whether the follow-up would edit any file the source PR also edits.

**Case (shader-slang/slang#12520, 2026-08-13):** #12520 asks to "mirror the Liquid-safety guard from #12511" into the design docs driver. The issue body reads in the past tense ("#12511 restored the build", "added two protections"). But **#12511 was OPEN/unmerged** — its `lint_liquid_safe` was not on master at all, and the follow-up's item ("widen the tests driver the same way") edits `docs/generated/tests/_meta/regenerate.py`, the **exact file** #12511 changes. So the follow-up had a *hard* ordering dependency (a merge conflict on an in-flight PR fixing a live outage), not a soft "nice to do after" one. Correct disposition: HOLD, report ready-for-fix, recommend the parent arm a merge-gate on the source PR, and do NOT dispatch the fixer to build against a file the source PR owns.

**Two more traps that generalized here:**
1. **Past-tense issue prose describes the intended POST-MERGE state, not master.** The same body claimed the guard "restored the build" while GitHub Pages was still `errored` on master (verified via `gh api repos/O/R/pages/builds`). The live fatal line was in a *different* tree than the follow-up touches, so merging the follow-up would not have restored Pages — a framing error worth correcting publicly.
2. **"Add the check beside the existing per-doc lint" can be a no-op for the exact files that motivated the issue.** The design driver lints generated docs via `lint_doc` but lints `_meta/gap-intake/*` via a separate `lint_gap_intake_report`. All 8 motivating occurrences were in gap-intake ⇒ a naive add to `lint_doc` misses them. The author's "scope to any driver-owned file carrying front-matter" was load-bearing, not stylistic — verify which enumeration path actually visits the motivating files before endorsing an implementation shortcut.

**Also:** a lint whose opener regex flags *any* `{{` (incl. benign terminated `{{N}}`) means "add the lint" and "fix the existing benign occurrences" must ship in ONE PR, or the gate goes red on merge.
