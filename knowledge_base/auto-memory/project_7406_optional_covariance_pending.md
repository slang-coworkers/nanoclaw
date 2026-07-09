---
name: project_7406_optional_covariance_pending
description: "#7406 Optional<Derived>→Optional<Base> conversion gap; RE-OPENED — maintainer jkwak closed his draft #10869, asked bot to create new PR (Approach A)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1c5e1fb2-fc5a-4413-af96-dc80643c83ff
---

**#7406** — `Optional<Derived>` won't implicitly convert to `Optional<Base>` when `Derived : IFoo` (both concrete-impl and associatedtype cases). Compile-time E30019 only, no miscompile. Filed by tdavidovicNV per Scene2 presentation; labels `Dev Opened`/`RTR`/`Bug`.

**Triaged (07-08):** bug/feature-gap · low sev · frontend (type checker/conversion) · P1 (maintainer-set). Reproduced on ToT (bfe6a7f14).

**Root cause:** `_coerce` (slang-check-conversion.cpp:1659) never recurses generic type args; `tryGetSubtypeWitness(Optional<Derived>,Optional<Base>)` is null (T invariant to facet system), generic-app fallback (:1776-1819) requires non-witness args equal. GENERAL gap — per-parameter variance unsupported (TODO slang-check-inheritance.cpp:1732) — not Optional-specific.

**Approach A (RECOMMENDED, and what jkwak's closed draft did):** targeted `_coerce` branch `Optional<A>→Optional<B>` gated on `tryGetSubtypeWitness(A,B)`, reusing MakeExistential + MakeOptionalExpr. jkwak's closed #10869 used `CastOptionalExpr` node + `optionalHasValue`-guarded rewrap in slang-check-conversion.cpp & slang-lower-to-ir.cpp + 6 optional-cast-*.slang tests.

**Timeline:**
- 07-08 triaged → fixer deduped → **draft PR #10869** (@jkwak-work) implemented exactly Approach A; bot stood down. GitHub: `reproduced` label + dedup comment 4916418444.
- 07-08 **RE-OPENED:** @jkwak-work CLOSED #10869 and commented on #7406 (comment 4916698719): "I closed #10869. Please create a new PR for this issue." → clear maintainer go-signal, resolves the A/B decision.

**⚠️ CARRY-FORWARD LESSON:** #10869's body read "Fixes issue #7406" (MALFORMED — stray "issue" defeated GitHub's closing keyword, closedByPullRequestsReferences empty). New bot PR MUST use correct `Fixes #7406` so it auto-closes.

**Progress (07-09 00:20Z):** jkwak asked bot for status (comment 4920298294); fixer posted honest reply (comment 4920340163). Ground truth: earlier build (bd410snuk) was killed by a SESSION TEARDOWN ~8h ago mid-compile of external SPIR-V-Tools (step 263/1170, never reached Slang C++) — an ENVIRONMENT INTERRUPTION, not a compile failure; edits still unverified. Fixer relaunched incrementally (cached objects survived). Code committed on `fix/issue-7406` (Approach A: CastOptionalExpr + optionalHasValue-guarded rewrap, no new IR op; 6 of #10869's tests + 1 new associatedtype test). NO PR/remote branch yet — worktree-local, verify pending. Remaining before draft PR: finish build → confirm both E30019 sites compile → optional suite (CPU/interpreter) → format → critique gates → draft PR `Fixes #7406` → report_pr_created. No blocker.

**PR #12013 UP (07-09 01:25Z) — MAINTAINER-APPROVED, HELD FOR MERGE DISCUSSION.** "Support implicit Optional<T> -> Optional<U> covariant conversion", head `fix/issue-7406`, base master. Main-verified live: body opens `Fixes #7406` (closing link REGISTERED — the #10869 malformed-keyword problem is fixed; issue #7406 now links #12013). 18 files +554: new `_coerce` covariance branch (cost innerCost+1) + synthesized `CastOptionalExpr` → optionalHasValue-guarded rewrap, NO new IR op; 7 tests incl. the assoctype case #10869 missed; new types-optional.md docs. One disclosed divergence from #10869: replaced its build-path SLANG_ASSERT with graceful CreateErrorExpr propagation on ambiguous inner coercion (defensively correct-by-construction, no deterministic surface repro → no dedicated test, noted in PR body). codex PLAN/CODE/OUTPUT approve; slang-reviewer (Reviewer A) dispatched as independent insurance on the ambiguity divergence, non-blocking.

**⚠️ NON-DRAFT = MAINTAINER-FLIPPED, NOT A BREACH.** Timeline verified: bot opened #12013 as DRAFT 01:25:20Z; jhelferty-nv assigned+requested reviewers (csyonghe, jkwak) 01:25:33Z; **jkwak-work flipped ready_for_review 01:30:26Z**; jkwak labeled Office-Yong 01:31:11Z. All gated actions are the maintainers'. Fixer held drafts-only correctly.

**jkwak review (comment, no changes requested, no inline):** "Looks good to me. I will discuss this PR with @csyonghe before merge it." → directional approval; merge deferred to jkwak↔csyonghe discussion.

**Formal state (07-09 01:38Z, triager-verified live):** reviewDecision=REVIEW_REQUIRED, mergeStateStatus=BLOCKED, csyonghe requested as reviewer. jkwak's "LGTM" is a COMMENTED review (soft approval + explicit merge-hold), NOT a green-to-merge. CI clean: 13 success / 45 skipped / 1 pending / 0 fail, mergeable=MERGEABLE.

**FYI stale draft #8228** (jkwak, Aug 2025, same feature) still open — jkwak's to reconcile against #12013, NOT ours to touch.

**State:** CHAIN PARKED pending jkwak↔csyonghe merge discussion. Fixer reports webhooks route to it (PR ownership registered); PR #12013 events → fixer (also branch-convention `fix/issue-7406` fallback). No bot action pending; fixer acts on further review/CI events via webhook. Ready-flip already done by maintainer; MERGE is jkwak+csyonghe's call — bot does NOT merge/auto-close. Re-engage only on a substantive human comment / CI-red / review-change event. See [[feedback_drafts_only_guardrail]], [[feedback_github_writes_operator_authorized]], [[feedback_no_double_dispatch_peer_wired]], [[feedback_verify_report_pr_created]].
