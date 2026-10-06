---
type: chain
title: slang#13259 (+#12934) — ICE in analyzeExtractExistential*; fixed producer-side by PR #12935
description: MERGED 2026-10-05 as e6be8dcdd7. A consumer-side none() fix was publicly claimed, then disproven by a reporter's repro; reworked to a producer fix in makeInfoForConcreteType.
tags: [slang, ir, typeflow, dynamic-dispatch, closed, overclaim-lessons]
---

# slang#13259 / #12934 → PR #12935 (MERGED)

**Outcome.** PR [#12935](https://github.com/shader-slang/slang/pull/12935) was squash-merged on 2026-10-05 at 14:25Z as `e6be8dcdd7`. jvepsalainen-nv approved it in review 5414768215. #12934 and #13259 closed as COMPLETED through `Closes`. CI: 60/60 on the PR, and the merge-queue run passed.

**Root cause (fixer's trace, confirmed by slang-reviewer with a three-way build).** In fixpoint iteration ≥2, the FuncToCall fallback in `propagateInterproceduralEdge` re-read a callee's declared return type. An earlier iteration had already rewritten that type to a `TaggedUnionType`. `isConcreteType(TaggedUnion)` is true through its default branch, so `makeInfoForConcreteType` wrapped it as `UntaggedUnion{TaggedUnion}`. That nested existential isn't a valid info shape. **Fix:** a shared `isRefinedInfoType` predicate, so `makeInfoForConcreteType` returns refined info unchanged. Both analyzers went back to master's `SLANG_UNEXPECTED`. A narrow `SLANG_RELEASE_ASSERT` rejects a top-level `SetTagType`.

**Timeline of near-misses (why this chain took 10 days):**
1. 09-25. The triager said "#12935 is idle and mergeable, blocker = merge". In fact it had an unresolved CHANGES_REQUESTED. The fixer caught it.
2. 09-25. Option-(a) "unreachability proof" plus a `SLANG_RELEASE_ASSERT` on the consumer arm. Approved via an adversarial codex pass. Then posted to the reviewer at 07:00.
3. 09-25 06:14, **before** that post. tdavidovicNV's repro compiled without any ICE but produced ill-typed DXIL, SPIR-V and CUDA. Its webhook went to the sibling 12934 session, and nobody re-read the PR before posting. We posted corrections on 09-26 and put the PR in draft.
4. Producer plan (gdb-simulated) → real-code gate → push `a0f6d1550b` + proposal. slang-reviewer flagged that the "closest to option (a)" mapping overstated the case. The follow-up correction plus 6 probe tests went into `d5d5924d64`.
5. Maintainer approved on 10-05.

**Infra hit along the way.** codex-cli 0.155.1 removed `mcp-server`, which silently dropped `mcp__codex__codex` fleet-wide (09-25 → 09-28). The operator pinned 0.153.4. Upstream later moved the runner to `codex-mcp-bridge.ts` over `app-server`. Separately, the falcor-build-approval-gate wedge held the PR's CI.

**Leftover: resolved 10-05.** The sibling #12934 session removed `wt-slang-12934` and `active-work/slang-12934`. It archived the uncommitted leftovers to its `reports/12934-artifacts/wt-archive/` and marked `memory/fix-12934.md` MERGED. Only the local `fix/issue-12934` branch ref remains, which is harmless.

Shared learnings filed: "verify a PR's review state before calling it idle-mergeable", "an assert-backed invariant must be tested on validated output of nearby shapes, and the PR re-read before a public claim", "codex MCP silently missing: 0.155.1 has no mcp-server".
