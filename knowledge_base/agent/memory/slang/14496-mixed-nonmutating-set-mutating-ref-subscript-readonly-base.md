---
type: chain
title: "slang#14496 — mixed [nonmutating] set + [mutating] ref subscript writable on read-only base"
description: Chain record for shader-slang/slang issue 14496, triaged 11-16 and in fix with slang-fixer on the canonical thread
---

# slang#14496 — Subscript `[nonmutating] set` + `[mutating] ref` writable on read-only base

- **Filed:** 11-16 06:5xZ by kmate19 (human), found while working on #14462 (PR #14495) — distinct
  bug, no other issue covers the mixed-accessor l-value split. No assignees.
- **Webhook:** redelivered twice 08:07Z after a sibling-Main 06:51-06:54 errored turn (auth-outage
  window); handled once.
- **Triage (triager, 08:14Z):** bug / high severity / IR-lowering (defect spans checker+lowering) /
  P2. Both repros CONFIRMED on master cdca151fb: `p->v[0].x = 3` through `Ptr<Holder, Access.Read>`
  compiles clean and writes the pointee via the `[mutating] ref` (silent miscompile); `let` case
  passes checking, dies E40017 in lowering. Root cause: `CompleteOverloadCandidate`
  (slang-check-overload.cpp:1683-1730) grants l-value from the FIRST set/ref accessor (shape-blind);
  `tryGetAddress` Aggressive (slang-lower-to-ir.cpp:9838-9880) independently binds the `[mutating] ref`.
  No `isEffectivelyMutating` symbol on master — mechanism via `findEffectiveThisParamInfo` +
  `doesParamPassingModeIndicateWritableStorage`. Memo: triager `memory/issues/triage-14496.md`
  (copy in `/workspace/inbox/a2a-1794816873919-us92bs/triage-14496.md`); repro at
  `/workspace/agent/scratch-14496/`.
- **Fix:** slang-fixer session `sess-1794816890955-q0i8n7` live 08:14Z on canonical thread
  `gh-issue-shader-slang/slang-14496` (triager handoff seq 2/4 + my redundant relay msg 35 + memo
  file, same session — no duplicate). Recommended **Approach A**: lowering writability guard in
  `tryGetAddress` Aggressive — don't bind a ref accessor needing writable storage unless the base
  provides it; fall back to `assign`'s setter round-trip (:10099-10128, :10240-10324). B (checker-side
  shape-aware rejection) and C (rejected — regresses gh-4971) in the memo. Must-pass tests include
  tests/bugs/gh-4971.slang; new test covering both repros lands with the fix.
- **Fixer progress 08:42Z:** worktree `fix/issue-14496` @ cdca151fb, plan at `reports/slang-14496.md`,
  repro test `tests/bugs/gh-14496.slang` written, Approach A confirmed with one recon addition (fixer's
  finding, unverified by me): `extractField` (slang-lower-to-ir.cpp:1204) drops the base pointer's
  Access qualifier when building field addresses, so the guard needs that propagation to see
  read-only-ness. Build ~20 min (network fetches staged offline from shared base build due to the
  auth outage); then repro-fail → fix → verify → PR.
- **[Fix Report] 10:45Z (fixer):** fixed. 2 files +118/−22: tests/bugs/gh-14496.slang (Access.Read
  ptr + ImmutablePtr + let repros) and slang-lower-to-ir.cpp — extractField (:1204) propagates the
  base pointer's access qualifier into field-address types (non-default-qualified bases only;
  unqualified byte-identical); tryGetAddress BoundStorage guard (:9922, helpers :9844/:9856) refuses
  a ref accessor needing writable storage unless the base is ReadWrite-qualified → assign falls back
  to the get/modify/set round-trip via the `[nonmutating] set`. Repro fails on unfixed master
  (pointee write + E40017), passes post-fix on CPU + CUDA/L40S; must-pass 7/7 incl. gh-4971; sweeps
  all 100% (diagnostics 1076, language-feature 2714, autodiff/func-extension 68, bugs 1014). Codex
  gates: PLAN_REVIEW r2 approve (r1 caught the `!= Read` → `== ReadWrite` Immutable fixup),
  CODE_REVIEW + OUTPUT_REVIEW approve. CI run 43848286442 in flight; explanation comment
  #issuecomment-6913939304 updated in place. Awaiting: slang-reviewer R1 (running, sess-…-acx4e0),
  CI. Non-blocking maintainer call flagged: let case as checker error? Known pre-existing hazards
  documented in PR explanation (`&local` Ptr Vulkan device-lost; `__ldg` on Access.Immutable CUDA
  loads) — not regressions. Ready-flip → weekly list.
- **R1 verdict 12:30Z (reviewer, REQUEST_CHANGES — 1 bug / 5 gaps / 0 Q; diff sha256 885cf340…05aa2):**
  🔴 must-fix `materialize()` ref-accessor fallback (:1283, unchanged by the diff) still binds a
  `[mutating] ref` to a read-only base on the READ path (getter-less set+ref subscript read via
  `Ptr<_,Access.Read>` invokes writable this) — invariant enforced at only 1 of lowering's 3
  ref-binding sites. Three-way convergent: `canProvideWritableStorage` (:9863) accepts only
  ReadWrite, misclassifies `WriteOnly` (`__ref_writeonly`) → get/modify/set path LOADS write-only
  memory (must-address: add WriteOnly to writable set or assert unreachable). gh-4971: NO regression
  (A confirms). extractField propagation: ordinary codegen unchanged, but C003 = behavior change
  w/o targeted test + 3rd inline copy of the pointer-qualification derivation (one-source-of-truth;
  same latent drop at 5 other emitFieldAddress sites). Test gaps: writable-base positive test,
  diagnostic pinning (checker l-value contract + `InvalidLValueForRefParameter`). A-vs-B disagreement
  on WriteOnly severity surfaced for fixer, not adjudicated. combined-review.md sent to me + fixer
  (fixer receipt verified seq 36). Round 1 → fixer applies, re-verifies, re-sends [Fix Review Request].
- **R1 apply round complete 13:30Z (fixer):** head `c59f63400` (commits 8ab9e90, 913ba7a, c59f634,
  incremental). (1) enforcement moved to the single funnel `_emitCallToAccessor` + new **E40027**
  for accessor invocations needing a mutable receiver on *proven* read-only/immutable bases
  (covers the materialize read-path hole, assign's setter arm, mutating getters; "proven" bar
  because the conservative version false-positived writable existential bases —
  special-members-setter.slang, caught by full sweep). (2) `canProvideWritableStorage` accepts
  WriteOnly. (3) tests: rvalue case + companions (writable-base codegen CHECK, checker l-value
  contract, E40027/E40008 refusals). Suites 100% at head (diagnostics 1076, language-feature 2714,
  autodiff 1030, bugs 1017). R2 [Fix Review Request] sent; CI re-triggered. Pre-existing limitation
  documented (NOT a regression, candidate for a future issue): no backend can execute a call to a
  ref accessor whose body returns an l-value — CPU/CUDA reject at coercion, Vulkan segfaults
  (repro'd on master). [Fix Report] follows R2 verdict. **RESOLVED as a dup by triager 14:38Z: mapped
  to existing issue #9636** (second shape of its known ref-accessor Ptr-vs-loaded-value root;
  evidence comment #issuecomment-6919482688 + `reproduced` label added to #9636, master-verified;
  fix path tracked by drafts #13152/#13153; awaiting maintainer policy on #9636 — no new chain).
- **Issue artifact landed:** #14496 has 1 comment (5-bullet, t-9e541c fired) + `reproduced` label
  (14:3xZ); Issue Type left to humans per triager policy.
- **R3 verdict 14:53Z (reviewer, FINAL round — APPROVE_WITH_NITS; diff sha256 3844f8c9…498e7):**
  all gating items verified applied (pointer-member IR-level pin w/ justified deviation, set-fallback
  E40027 coverage, decision (a) with scoped comment); core mechanism verified sound by all four
  A-reviewers (funnel coverage complete, E40027 recovery well-typed dead IR, classification
  asymmetry coherent). Nits to apply WITHOUT another round, then final [Fix Report]: (top) no
  discriminating test on extractField's behavior-changing region — every test base is Device-space
  where old code already derived; changed shape = Generic-space `__ref`-param bases (A's drill:
  deleting the derivation block leaves all PR tests passing; suggested: `__ref_readonly V v`
  component write must round-trip through the set); leading `//IR-NOT` in gh-14496-writable.slang;
  E40027 message receiver/base naming + dead `tryGetStoragePointerType` decl; one sentence on
  visitSwizzleExpr's tuple fast path; hoist-vs-local = fixer's call (keep-local + follow-up issue
  for the bit-field sibling caller's latent hole acceptable); optional coverage extensions. No
  disagreements; autodiff flake consistent w/ known GPU-nondeterminism. Trajectory: R1 RC (1 bug/5
  gaps) → R2 RC (0/2/1) → R3 A_W_N (0/5/1). Fixer receipt evidenced (session last-active 14:53).
  After the fixer's nit round + [Fix Report]: chain RESTS on maintainer review; ready-flip →
  weekly list.
- **Nit round applied 15:33Z:** head `b85ed9f` (named derivation helper, single-term E40027 wording,
  leading IR-NOT in gh-14496-writable.slang, `__ref_readonly` discriminating pin — revert-drill
  verified, `__ref_writeonly` disjunct pin). Follow-up **#14503** filed by nv-slang-bot:
"Field addresses of read-qualified bases default to read-write at typed emitFieldAddress call
  sites" (the derivation-consolidation / sibling-caller latent hole). **#14503 is owned by THIS
  chain — its issue_opened webhook needs NO dispatch.** Final explanation comment updated.
- **#14503 CLOSED by kaizhangNV 11-18 19:16Z** (comment "So I will close this issue now." right
  after telling @jhelferty-nv the issue follows PR #14500, which they are reviewing; no
  @nv-slang-bot mention in either comment — no bot action requested). The latent-hole
  consolidation direction now has NO open tracking issue; chain state otherwise unchanged (PR
  #14500 still rests on maintainer review).
- **FINAL [Fix Report] 15:35Z — chain RESTING on maintainer review:** PR #14500 head `b85ed9ff6`
  (8 commits, 3 source files +~250/−~60, 5 test files). Final shape: named helper
  `getFieldPtrTypeInheritingBaseQualifications` (extractField inherits base access qualifier/
  address space/layout into field-address types; plain form for fully-default bases);
  `tryGetAddress` refuses writable-needing ref accessors on non-writable bases (set round-trip);
  `_emitCallToAccessor` funnel diagnoses E40027 + substitutes default-constructed value on proven
  read-only storage (covers materialize read path, assign fallbacks, mutating getters, properties);
  `canProvideWritableStorage` = ReadWrite+WriteOnly. Tests: repro fails on master, passes at head
  (cpu + cuda/L40S); 5 test files incl. IR-level pins + revert-drill-verified discriminating pin.
  Suites 100%: diagnostics 1076, language-feature 2714, autodiff 1030, bugs 1018. Review converged:
  R1 RC → R2 RC → R3 APPROVE_WITH_NITS, all nits applied; declined-with-reasons: IR-NOT comment
  widening, backend-gap restatement, citation-range widening. CI re-triggered at head (earlier runs
  yielded to human-priority bot queue; retry mechanism reruns). Ready-flip → weekly undraft list
  (weekly-undraft-list-4573). Open maintainer call: let-case checker-vs-lowering semantics.
  Side finds: Vulkan segv → deduped into #9636 (triager, evidence posted); sibling-site hole → #14503.
- **R2 verdict 13:54Z (reviewer, REQUEST_CHANGES — 0 bugs / 2 gaps / 1 Q; diff sha256 90644312…d654a):**
  R1 bug + WriteOnly convergence VERIFIED FIXED; funnel enforcement sound (security + ir-correctness).
  Gating gaps = test coverage on the must-not-fire direction: (1) writable POINTER-member base
  (`hp->v[3].z` on `Ptr<Holder>`) — the one shape extractField rebuilds a pointer type for —
  untested (existing pin uses a local var, bypasses Ptr case); (2) `_emitCallToAccessor` guard's
  assign set-fallback route (`[mutating] set` + `[mutating] ref` on read-only ptr) — new code, zero
  coverage. Question for fixer: conservative refusal now rejects previously-compiling aggressive
  address-taking on non-Ptr bases (`__ref` param E40008 where master compiled; `&expr` on those
  shapes hits SLANG_UNIMPLEMENTED_X ICE, contradicting the guard comment) — fixer picks scope
  comment + route `&` through E40008, or collapse base before refusing. Clarity advisory (strongest:
  extractField comment's motivating example is a no-op for the hunk — Ptr<T> defaults Device where
  maybePropagateAddressSpace already fired; actual changed shape = Generic-space ref-param bases).
  Fixer receipt verified seq 44. Round 2 = LAST round: apply, re-verify, re-send [Fix Review
  Request]; anything unresolved ships listed.
- **R2 apply round complete 14:30Z (fixer):** head `9ed2333e3` (7 commits). (1) writable pointer-member
  must-not-fire pinned at IR level (`-no-codegen -dump-ir -g0`, tests/ir corpus pattern — every
  executable/emit vehicle hits a pre-existing wall on that exact shape: hlsl E36107 pointer gate;
  spirv emitter assertion "field_address requires base and result to have same address space",
  reproduced on UNMODIFIED master). (2) assign set-fallback + mutating-property cases pin E40027
  through the funnel. (3) Option (a) chosen on non-Ptr aggressive address-taking — comment scoped
  (getAddress diagnoses; `&` abort = pre-existing checker-gated sharp edge). All R2 clarity items
  applied (neutral wording, corrected extractField comment + PR root-cause attributing the fix to
  the tryGetAddress refusal, shared storage-ptype + source-loc helpers). Sweeps 100%: diagnostics
  1076, language-feature 2714, bugs 1017; autodiff 1029/1030 (1 confirmed cuda numeric flake, passed
  2x isolated rerun). Final [Fix Review Request] (R3, last round) dispatched; Vulkan-segfault side
  find relayed to slang-triager. Awaiting R3 verdict + CI.
- **GitHub writes:** auth outage RESOLVED by ~10:22Z (fixer pushed + created the PR through the
  gateway). Issue #14496 comment + `reproduced` + Type=Bug still pending on triager one-shot
  `t-9e541c` (fires 14:00Z — still needed; issue unlabeled as of 10:35Z).
- **PR:** draft **#14500** "Don't bind a ref accessor needing writable storage to a read-only base"
  (nv-slang-bot, branch `fix/issue-14496`, head `528230393200f08dc9f6b191fde9a22150ad5cde`, created
  ~10:22Z), fixes #14496; pr-mapping → fixer session confirmed. Explanation HTML in
  `/workspace/inbox/a2a-1794825284325-xh8wrx/`. Reviewer R1 dispatched 10:4xZ.
