---
name: project_12136_load_autodiff_builtins_on_demand
description: "#12136 load autodiff builtins on demand — BLOCK@ecd20386 FIXED; re-decide ABSTAIN_POLICY(size-cap)@04d90845; sanitizer link-fail new"
metadata:
  node_type: memory
  type: project
  originSessionId: 9e00866d-1161-40f3-983f-d565d8f96442
---

# #12136 "Load autodiff builtins on demand" (jvepsalainen-nv)

Trajectory: **fallback ABSTAIN → BLOCK (verified 🔴 SIGSEGV) → fix-push → ABSTAIN_POLICY (size-cap short-circuit)**. Routed pr_ready_for_review → slang-pr-approver only, shadow mode (never posts to GitHub).

## R-BLOCK @ ecd203861178 (2026-07-16) — SUPERSEDED, root cause now FIXED
BLOCK `RED_BUG:autodiff-lazy-load-crash-on-IDifferentiable-constraint`. `IDifferentiable`/`IFloat` used only as a **generic constraint** (or reflected) fired **neither** lazy-load trigger ((a) `[Differentiable]` callable, (b) fwd/bwd/primal-substitute expr) → supplement never loaded → SIGSEGV at `unit-test-function-reflection.cpp:383` (`findTypeByName("MyStruct<float>")`). Verified CI job 87553860992, 8 test-slang jobs red, deterministic. Flipped from fallback ABSTAIN when the production review landed late (its gap #1 = incomplete trigger set; challenger escalated to verified crash). Learning: a late primary review supersedes a fallback ABSTAIN; a "0-bugs" review's own main-concern gap can be a verified crash.

## R-ABSTAIN @ 04d908456991 (2026-07-17, live_late) — CURRENT recorded row
Fix-push. Reason **CLAUSE_FAIL:tier_eligible** — diff grew to **3355 lines > 2000-line size cap** (mostly a source MOVE: diff.meta.slang −1444 / new autodiff-base.meta.slang +1265 + a master merge), so Step-1 short-circuits to ABSTAIN_POLICY (human must eyeball scope) BEFORE the challenger gates. Two verification facts (context, not the recorded reason):
1. **Prior BLOCK root cause FIXED** — eager base now carries `Array/Optional/Tuple : IDifferentiable` + TensorView/TorchTensor/DiffTensorView/detach/update-helpers/makeArrayFromElement surface; CI confirms the two previously-crashing tests pass, **all 10 test-slang jobs green**.
2. **NEW PR-caused red CI (sanitizer)** — sanitizer job fails to LINK the PR's new `tools/slang-unit-test/unit-test-lazy-autodiff-module.cpp`: *undefined reference to typeinfo for Slang::Session* — touches polymorphic internal `Slang::Session` via `asInternal()` under `-fno-rtti`; sanitizer's `-Wl,--no-undefined` makes it a hard fail (regular builds link lazily, passed). Real error (not DWARF noise), PR-caused (new file, green at prior head, other PRs' sanitizer green).

**Next-action:** (recorded) diff > size cap → human eyeball scope (mostly relocation). (independent) new unit test must not depend on RTTI/typeinfo for internal `Slang::Session` — access `coreModules` via a non-polymorphic path OR exclude the test from the `-Wl,--no-undefined` sanitizer build; re-run sanitizer to green.

## ✅ RESOLVED stale-head question (Main + approver, 07-17)
Confirmed settled: `04d908456991` **IS** the current PR tip (byte-equal to `gh api .../pulls/12136 .head.sha`). Its parents are `b74934ff1eb5` + master merge `4f4ec505761e`, so `d7b8a430d` is **NOT an ancestor** — the `d7b8a430d` production review (and the author's "addressed in d7b8a430d" comment) were against a rebased/parallel tip the branch has since moved OFF. No even-later push exists on the branch. Ancestry check earned its keep: the decision is against the real tip, AND the author's `d7b8a430d` fix claims never landed on this branch tip.

**Sanitizer STILL RED at current head** (job 87755069724, single attempt): `sanitizer-linux-clang-x86_64` = failure + `check-ci` aggregator = failure; 10/10 test-slang green. So the `unit-test-lazy-autodiff-module.cpp` typeinfo / `-Wl,--no-undefined` link break is NOT resolved at 04d90845 — the "new PR-caused red CI" context item and its next-action STAND.

Author's (parallel/off-branch) `d7b8a430d` consolidation had claimed: eager/lazy boundary corrected, RELEASE_ASSERT→SlangResult+rich diagnostic (`UnableToLoadAutodiffModule`), idempotent cache merge, null-deref guarded, RSS 208.8→119.0 MiB (−43%). Those claims do NOT apply to the recorded head 04d90845 (different lineage).

Awaiting human verdict for the join. See [[feedback_approver_never_posts_route_reviewer]], [[feedback_verify_pushed_state_by_branch_not_sha]].
