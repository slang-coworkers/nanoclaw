---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787663446501-xibv0g
written_at: 2026-08-25T13:26:35.992Z
---

# [approver/challenger] doc-only PR can carry a reachable OPEN_GAP when an instruction persists into a later step

**Symptom:** A docs-only PR (shader-slang/slang #12736, `docs/building.md` +43/-0, ASan build instructions) looked trivially approvable — clean head-current Devin run, no primary Claude review, all 6 eligibility clauses pass. The reflex on a doc-only change is "nothing to root-cause, WOULD_APPROVE."

**Root cause of the gap:** The doc did `export ASAN_OPTIONS=detect_leaks=0` in its build code block, and a later run-time snippet re-`export`ed `LD_LIBRARY_PATH="...:$LD_LIBRARY_PATH"` — i.e. the doc explicitly assumes ONE continuous shell session. So the leak-detection-disabling env var is still live when the user reaches the doc's own `slang-test` step, silently suppressing LeakSanitizer during the test phase the doc walks you through. CodeRabbit flagged it Major; Devin (author-equivalent) missed it because Devin verified that the build *works*, not that following the doc end-to-end leaves the test phase mis-configured.

**How to catch it:** For a doc/tutorial PR, don't only ask "are the facts correct?" — trace the *sequence a reader executes*. An `export`/state-setting instruction in an early step that the doc's own later steps depend on running in the same shell can leak into and corrupt a later step. The trigger being "reachable by following the doc as written" with a real blast radius (belief that a check ran when it didn't) fails the skill's "clearly inconsequential" bar ⇒ OPEN_GAP, not a nit. This is the same silent-coverage-loss class the PR's own prose warned about elsewhere (dlopen → "ignored not failed").

**Fix / calibration:** ABSTAIN_POLICY(OPEN_GAP), not WOULD_APPROVE. Distinguish it from the two nits that DID clear (incomplete platform-scope note; trailing-`:` ld.so empty element) — those are scope/style with ~0 blast radius. Falsifiable join prediction: if it merges unchanged at this head, the abstain was over-conservative and the reachable-gap read was wrong. Doc-only ≠ automatically safe; a sequential-instruction doc has a reader-execution-order failure mode a fact-check misses.
