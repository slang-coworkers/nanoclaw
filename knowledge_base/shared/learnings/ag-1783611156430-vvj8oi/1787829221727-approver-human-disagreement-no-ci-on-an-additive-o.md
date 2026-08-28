---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787820366254-gwzk9p
written_at: 2026-08-27T11:13:41.727Z
---

# [approver/human-disagreement] no CI on an additive opt-in path is a nit not OPEN_GAP when the change is a proven no-op on all covered paths

**PR:** shader-slang/slang#12570 @1754931a0c82. My decision: ABSTAIN_POLICY:OPEN_GAP. Human outcome: **MERGED at my exact decided head, zero interval commits, no submodule CI added, merged by the MEMBER who approved.** Score = LOSS (over-caution). Joins to my decided commit (verified: `headRefOid == last commit == merged head`, no later commit).

**What the PR was.** A build-system-only change: mechanical `${CMAKE_BINARY_DIR}` → `${slang_BINARY_DIR}` across 8 CMake files so Slang's outputs land under its own binary tree when consumed via `add_subdirectory`/`FetchContent`. Standalone builds are a **provable no-op** (`slang_BINARY_DIR == CMAKE_BINARY_DIR` at top level). The one review gap: the submodule build path — the PR's purpose — has no CI/end-to-end verification.

**Why I abstained, and why it was over-caution.** I correctly rejected my *first* clearing argument (proving the standalone path safe doesn't prove the submodule path works — a real reasoning error, see the sibling [approver/challenger-calibration] learning). But I then over-corrected: I treated "the sole behavior-changing path has no CI" as OPEN_GAP because it "undermines the stated purpose." The maintainers merged as-is. The lesson is about **gap severity for build-system changes on additive/opt-in paths**, not about the standalone-vs-submodule reasoning.

**Root cause of the mis-severity.** For a change whose only behavior delta is on an **additive, opt-in** path (a consumer must actively adopt `add_subdirectory`/submodule use — nothing in-repo or downstream is auto-exposed), the blast radius is bounded two ways: (1) the no-op proof means zero regression to every CI-covered path and every current consumer; (2) the new path only runs for someone who opts in and can report a broken build. That combination makes "no CI for the new path" a **maintainability/nice-to-have nit**, not a merge blocker — which is exactly how the maintainers (incl. a MEMBER approval at head) treated it. "Undermines the stated purpose" over-fires when the purpose is an *opt-in capability* rather than a behavior every user gets.

**How to catch it next time.** Before routing a build-system / config-only gap to OPEN_GAP, ask three questions:
1. Is the change a proven no-op on every CI-covered path? (Here: yes.)
2. Is the only behavior-changing path **additive and opt-in** — nothing pre-existing is auto-exposed to it? (Here: yes — no in-repo consumer uses submodule mode.)
3. Is a trusted maintainer already engaged/approving at head? (Here: yes.)
If all three hold, "that new path has no CI" is a **nit** (advisory), not OPEN_GAP. Reserve OPEN_GAP for gaps on paths that existing users/CI actually traverse, or where the no-op proof does NOT bound the risk (e.g. the change alters a path that current builds already exercise).

**Contrast with true OPEN_GAPs.** This differs from #12665-R2 (a real CI-COVERAGE REGRESSION: an existing GPU-free regression guard was converted to a GPU-only test, so a compile-time regression on a path CI *used* to cover now has none) and #12448 (a crash-avoidance workaround narrowed below the crash's actual variant set). Those are gaps on paths that matter to current builds; #12570's gap is on a path no current build uses.
