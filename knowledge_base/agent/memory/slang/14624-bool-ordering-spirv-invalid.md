---
type: chain
title: "slang#14624 — bool ordering comparisons emit invalid SPIR-V (OpULessThan)"
description: Chain record for shader-slang/slang issue 14624, triaged and handed to slang-fixer 2026-11-19
---

# slang#14624 — Ordering comparisons on Boolean values generate invalid SPIR-V

Human-filed 11-19 01:0xZ by **tangent-vector** (maintainer; self-assigned — NOT a stand-down per R6;
also carries "Tess's Label" like #14612). Dispatched at once: 👀 reaction posted, triager sent on the
canonical thread `gh-issue-shader-slang/slang-14624` with `<github-post-authorized />` (Main webhook
session sess-1795050878493-8b24ef).

## Triage (slang-triager, 01:32Z; Main-verified claims)

- bug / high / **P2** / component: IR (core-module lowering → target emit). Issue Type `Bug`
  GraphQL-verified live; `reproduced` label live-verified. No regression label — the feature was born
  broken by #3317; never worked on SPIR-V/GLSL/WGSL. Not a duplicate; related: #12720, #14402, #3317.
- Root cause: #3317 made `ILogical` refine `IComparable`, giving `bool` an ordering conformance whose
  `lessThan`/`lessThanOrEquals` are raw `__intrinsic_op(kIROp_Less/Leq)` (core.meta.slang:1294-1295) →
  `kIROp_Less(bool,bool)` → SPIR-V picks `OpULessThan` (slang-emit-spirv.cpp:879) since `isSignedType`
  excludes bool. Reproduced on rebuilt master `d9a12fa17` with the validator:
  `Expected operands to be scalar or vector int: ULessThan`. GLSL/WGSL text emitters also emit invalid
  `bool < bool`; HLSL/Metal valid via bool→int promotion. `vector<bool>` comparisons already valid
  (lower through intCast) — only scalars broken.
- Recommended fix: **approach A** — semantic bodies in the Bool arm of core.meta.slang:1294-1295
  (`lessThan = !this && other`, `lessThanOrEquals = !this || other`), exactly the issue's prescribed
  lowering, producer-side, fixes all targets at once. B = `__intCast<int>` wrapping (also valid);
  C = checker eligibility (incomplete); D = SPIR-V emit promotion (consumer-side patching, rejected).
- Test neighborhood: tests/language-feature/bool-bitwise-ops.slang. Invalid SPIR-V only surfaces under
  `SLANG_RUN_SPIRV_VALIDATION=1` (drivers run the module anyway).

## State

- **TERMINAL our side 05:32Z — [Fix Report] accepted, Main-verified**: draft PR #14628 @ `585eea914`
  (fix/issue-14624, `pr: non-breaking`, 5 commits, +165/−2 live-verified, still draft). Awaiting human
  maintainer review; webhooks (CI/review/comments) route to fixer sess-1795051947481-xgz7hp.
  Ready-flip → weekly undraft list (P2, not P0/P1 — no per-PR operator ask).
- Fix detail: core.meta.slang bool `lessThan`/`lessThanOrEquals` = `and(!this, other)` /
  `or(!this, other)` (branchless free functions → BitAnd/BitOr → OpLogicalAnd/Or on every target;
  both operands evaluated, exactly the issue-prescribed semantics) + identity/rationale comment.
  Tests: repro PASS cpu/vk/cuda (pre-fix vk failed `OpULessThan %bool`); validator clean; IR
  branchless; new tests/cross-compile/glsl-bool-ordering-ops.slang CHECK-NOTs bare relationals;
  suite 12352/12370, failures ⊂ baseline (18 vs 19, one flake flipped). Review: 3-reviewer panel
  (A correctness, B Devin, C clarity) APPROVE_WITH_NITS round 1 applied in full — top concern
  (short-circuit semantics) resolved via the branchless spellings; critique gates all approve at
  final head. Explanation cmt 6998076222 current for head.
- Fixer's "+168/−2" was GitHub-live +165/−2 at verify time (immaterial).
- **Follow-up (routed + FILED as #14631):** GLSL-style `lessThan()`/`greaterThan()`/`lessThanEqual()`/
  `greaterThanEqual()` free functions on `vector<bool>` still emit raw Less (pre-existing,
  glsl.meta.slang:293-300) — reviewer side-find + fixer [Fix Report] flag; routed to the triager's
  chain session 05:36Z (verified seq 8 in b6zfd3); triager **FILED #14631 05:40Z** (Main-verified
  live: nv-slang-bot, `reproduced`, repro on master `a22c14207` validator exit 2, deduped — #12720
  different defect class, linked related). **#14631 = FILED-ONLY, our own Terminal filing — its
  issue_opened is self-echo, NO dispatch.** Solution space = maintainer call (constrain-T-and-
  diagnose vs intCast/logical lowering — GLSL forbids these spellings on bvec, spec-faithful);
  fixer start gates on the operator/maintainer ask per filing policy.
  The "should bool ordering exist" design question stays with the issue author as a separate issue.
- Reviewer sessions: slang-reviewer sess-1795056314007-nid798 (panel lead) — review leg complete.
- **[Triage Resolution] delivered 05:35Z** — triager woke on Main's pinned relay (sibling-pin recipe,
  in_reply_to=12 webhook row, verified seq 6 inbound), patched triage cmt 6996912415 in place to the
  fix-in-PR state (Main-verified live, updated 05:35:13Z) and closed its leg. Triager also saved the
  LD_LIBRARY_PATH validator-silently-skipped learning.
- **MAINTAINER APPROVED 11-20 00:04Z** (Main-verified live): PR #14628 flipped ready by a human and
  APPROVED by tangent-vector at head `585eea914` (review 5985403150, empty body, nothing to apply).
  Ready-flip weekly-list entry retired (human flipped it).
- **MERGED 11-20 03:29:57Z — CHAIN TERMINAL** (Main-verified live): PR #14628 squashed by
  auto-merge (tangent-vector) as `85bde8dc0` after the test-falcor flake rerun went green;
  issue #14624 auto-closed 03:29:59Z. Fixer cleaned up worktree wt-slang-14624 + sentinel.
  End-to-end: repro → fix → 3-reviewer APPROVE_WITH_NITS (applied) → maintainer approval →
  master merge (BEHIND) → flake rerun → auto-merge. No further webhooks need dispatch;
  #14631 (FILED-ONLY side-find) is the only open descendant.
- Issue asks in "Additional context" whether bool ordering should exist at all — that deprecation
  question may warrant a maintainer take; the fix itself is uncontroversial per the issue author
  (a maintainer) prescribing the expected lowering.

- Triage comment **6996912415** posted 01:32:38Z, patched to fix-in-PR state 05:35:13Z (nv-slang-bot,
  Main-verified live) — the issue's resumable artifact.

Resume on human-maintainer review / comment webhook. Do not re-dispatch issue webhooks for #14624 — chain owns them.

**11-20 03:27Z — CI failure classified external Falcor flake; rerun dispatched (1 of ≤3).** The
post-merge-wait run 44644346792 (pull_request event, only run at head `b115660f0` = the live
verdict) failed one job: `test-falcor / Test (Falcor)`. Fixer classification (6-point rationale):
opaque bridge to the NVIDIA-internal Falcor pipeline (GitLab 83830234, per-test detail invisible);
`test-falcor-perf` PASSED on the same head/artifacts; falcor-gated Windows build + approval gate
passed; recent PRs' test-falcor green; known Falcor flakes tracked in shared learnings; the fix is
value-identical on Falcor's HLSL path. `gh run rerun --failed` dispatched (Main-checked: run back
to `queued`, no failure rows at the new attempt). **Auto-merge stays armed** — fires when the rerun
goes green. If red again with the same shape: attempt 3/3, then escalate for a human/NVIDIA-side
look (per-test detail internal; not blind-fixable). Webhook routes the outcome to the fixer.
