---
name: project_7406_optional_covariance_pending
description: "#7406 Optional<Derived>→Optional<Base> covariant conversion — SHIPPED (PR #12013 merged, issue auto-closed 07-09)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1c5e1fb2-fc5a-4413-af96-dc80643c83ff
---

**#7406 — SHIPPED / TERMINAL (07-09 23:26Z).** Implicit `Optional<Derived>` → `Optional<Base>` covariant conversion now lands. Filed by tdavidovicNV per Scene2 presentation.

**PR #12013 MERGED** by jkwak-work (merge commit b264071b8e, 2026-07-09T23:26:36Z, base master). **Issue #7406 auto-closed COMPLETED** 23:26:37Z via the registered `Fixes #7406` keyword. Main-verified live: PR state=closed/merged_at set; issue state=closed/closed_at set.

**Approach A (Main-verified in PR body):** one covariance branch in `_coerce` (slang-check-conversion.cpp) gated on inner coercibility at cost `innerCost+1`; front-end-only synthesized `CastOptionalExpr` → `optionalHasValue`-guarded rewrap in slang-lower-to-ir.cpp; NO new IR op. 18 files +554. Both E30019 sites fixed (concrete-impl + associated-type). 7 regression tests incl. the assoctype case #10869 lacked. One disclosed divergence from #10869: graceful CreateErrorExpr propagation replacing #10869's build-path SLANG_ASSERT on ambiguous inner coercion (defensively correct-by-construction).

**Review/CI:** csyonghe APPROVED (no findings); jkwak COMMENTED "LGTM"→upgraded APPROVED→merged. reviewDecision=APPROVED, MERGEABLE. One earlier `test-linux-release-gcc-x86_64-cpu / test-slang` exit-139 SIGSEGV was a CONFIRMED pre-existing CPU-job flake (crash at unrelated `tests/compute/static-const-matrix-array.slang.2`, which runs before + cannot invoke the Optional-only branch; job has retry logic; master cpu-job intermittently red) — reran green on identical commit 55101b50b5.

**Process notes (all correct, no breach):** bot opened DRAFT 01:25Z; jkwak flipped ready 01:30Z (maintainer, NOT bot); merge authority stayed jkwak's throughout — bot flipped/enqueued/merged nothing. Drafts-only guardrail held. Fixer cleaned up worktree wt-slang-7406 + sentinel; reviewer merge-stand-down delivered on its edge (3-reviewer pass non-blocking, returns via send_file).

**FYI:** stale older jkwak draft #8228 (Aug 2025, same feature) may still be open — jkwak's to reconcile/close, NOT ours.

**State:** CHAIN CLOSED — TERMINAL. Reopens only on a substantive human comment (post-merge regression, revert request). See [[feedback_drafts_only_guardrail]], [[feedback_github_writes_operator_authorized]], [[feedback_always_reap_merged_worktrees]], [[feedback_verify_regression_claims_at_precision]].
