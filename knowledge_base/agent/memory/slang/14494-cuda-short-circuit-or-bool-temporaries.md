---
type: chain
title: "slang#14494 — CUDA target: short-circuit || chains become bool temporaries (selp/SEL chains in PTX/SASS) instead of branches"
description: Human (albertrodriguezclo) 11-15/16; TRIAGED bug/P2 repro-verified, fixer live on solution A (pre-emit IR pass); GitHub writes parked behind auth outage
tags: [slang, chain, cuda, codegen, short-circuit, performance]
resource: raw/triage-14494.md
---

# slang#14494 — CUDA: `||` chains emitted as bool temporaries nvcc keeps as u16 select chains

- **Filed:** 2026-11-15 by human `albertrodriguezclo` (same reporter as #14390). No labels,
  **no assignees** (live-verified 11-16 08:00Z via anonymous GitHub read). No existing chain
  (grep clean). Human-filed, R6 no-wait → dispatched at once.
- **Bug:** On `-target cuda`, a short-circuit `||` chain feeding `if (...) continue;` is emitted
  as a chain of `bool` temporaries (one `if/else` per operand). NVVM keeps them as 16-bit
  values → `selp.u16`+`setp.ne.s16` (PTX), `SEL`+`PRMT 0x9910`+`ISETP` (SASS), later loads
  predicated. Hand-written CUDA with the same `||` compiles to plain compare-and-branch.
  Cost in repro kernel: +11.7% warp instructions, ~+5% kernel time. Splitting into one
  `if (x) continue;` per test produces SASS identical to hand-written CUDA (workaround).
- **Repro:** self-contained (grid_query.slang, slangc 2026.16.1 + 2026.22, nvcc 12.8, sm_89).
  Author proposes: emit `a || b` as C++ `||` when operands are inline-able/side-effect-free,
  or branch to the target from each operand when the chain feeds a branch directly.
- **Webhook quirk:** first delivery 06:50Z errored in a sibling Main turn (turn crash, seq 3
  "something went wrong"); redelivery 07:58Z handled by this turn. No dispatch had happened.
- **TRIAGED 11-16 08:10Z** (triager report, triager sess-1794816113589-itktyf): bug (perf-only,
  no correctness impact) / medium / IR → target-emit (CUDA) / **P2**; no duplicate (43
  "short-circuit" hits scanned; nearest #13278/#13279 coverage-marker context only).
  Repro independently verified on master 2026.13.1-50-g3649fb982 (L40S sm_89, nvcc 12.6,
  rebuilt slangc): SEL 15/PRMT 16/BRA 13 vs -DSPLIT 0/0/48 — matches reporter exactly.
  Root cause: `visitLogicOperatorShortCircuitExpr` (slang-lower-to-ir.cpp:6691–6754) lowers
  scalar `||` to an if-else diamond with bool merge param; `eliminatePhis` (slang-emit.cpp:2875)
  materializes it as IRVar; fold gates (`kIROp_Param`=FoldPolicy::Never,
  slang-emit-clike.cpp:1517/:1737) block refolding. Fix route **A (recommended, sent to
  fixer)**: pre-emit IR pass reconstructing kIROp_And/Or from the canonical diamond when
  operands are side-effect-free/single-use/no coverage markers, hooked **before** eliminatePhis.
- **Fixer:** slang-fixer sess-1794816680474-r2ahje live 08:11Z on canonical thread
  `gh-issue-shader-slang/slang-14494` (session verified). **Claimed 08:18Z** (sentinel set,
  triage memo read; master cdca151fb). Plan → `reports/slang-14494.md`, approach A per brief
  (pre-emit pass diamond→kIROp_And/Or, CUDA/C++-source gated).   Reading GitHub via
  direct-unauthenticated workaround; will retry gateway at push/PR time (patch fallback).
  12:26Z: building in fresh worktree `wt-slang-14494`; PLAN_REVIEW codex r1 done — 1 must-fix
  (speculation-safety gate for loads/calls hoisting) folding into plan; next IR dump (does
  slang_ldg fold at emit) → implement.
  **13:59Z: fixed + verified, committed on fix/issue-14494** (3 commits: bb5b2e311 failing
  repro tests → 11782e73c `__ldg` purity decorations → f0109e164 new pre-emit pass
  `slang-ir-reconstruct-short-circuit.cpp` hooked before eliminatePhis, CUDA/C++-source
  gated). Reporter's kernel now emits full inline `||` chain (0 bool temps), SASS SEL 15→0 /
  PRMT 16→0 / BRA 13→48 — same shape as -DSPLIT. Suite 12321/12324 (3 = pre-existing fp8
  PTX-JIT env failures, confirmed on master control). 5 new emit-level tests + pinned-text
  updated (metal-return-value-lost CUDA/CPP lanes now emit `passed_0 = A && B;` expression;
  9 lanes green). Non-obvious finds: slang_ldg needs BOTH func-level NoSideEffect AND
  param-level IgnoreSideEffects; pass needs its own trivial-block merge (fold helpers only
  fold same-block users).
  **14:21Z: branch pushed to origin fix/issue-14494 (durable, 3 commits). PARKED on
  critique-gate infra before PR:** (a) codex MCP bridge broken 11-16 — 5 timeouts + 3
  cross-talked responses (another session's recall output); (b) track-critique.sh never
  records codex rounds in this harness (critique_rounds stayed 0 through 2 successful
  PLAN_REVIEW verdict rounds) → gate cannot record → [Fix Review Request]/[Fix Report]
  refused. Fixer's one-shot `14494-critique-recheck` fires ~16:45Z and auto-resumes if
  bridge/recorder recovers; fixer will not bypass the gate. **Escalated to operator
  14:2xZ** (new topic on dashboard — dedupe-checked): restore infra or authorize
  peer-review-only proceed. Resume artifacts staged in fixer's
  `/workspace/agent/memory/fix-14494.md` (critique prompt, 996-char PR body, repro+log paths).
- **RESUMED 11-16 17:53Z; CRITIQUE RECHECK — MUST-FIX FOUND 18:12Z** (Main one-shot
  `14494-critique-recheck`, run 1): fixer's critique rounds completed (follow-up
  commit `1321a9a9f` 16:57Z; PLAN_REVIEW r3/3, CODE_REVIEW r1 approve,
  OUTPUT_REVIEW r1 must-fix→resolved→r2/r3 approve per fixer 17:57Z report);
  **draft PR #14506 opened 17:48Z** (4 commits, +813/−4, 10 files; explanation
  comment 17:50Z; `jhelferty-nv` auto-shepherd; three-reviewer pass A/C/B in
  flight; [Fix Review Request] dispatched to slang-reviewer).
  My independent codex CODE_REVIEW **r1 = must-fix** (client timed out but the
  round completed server-side — poll `~/.codex/sessions/…/rollout-*.jsonl`;
  r1 rollout 17-54-42, r2 rollout 18-00-25): **MF-1 — fold guarantee checked
  only on the memory read's IMMEDIATE edge (`canFoldIntoUseSite` at
  slang-ir-reconstruct-short-circuit.cpp:337), not transitively to the chain
  root.** Interior non-memory inst that the emitter refuses to fold (e.g. an
  Add feeding a multiref `(($0)+($0))` target-intrinsic call: `i < n &&
  twice(buf[i]+1.0f) > 0.5`) prints as a statement before the `if` with the
  load folded inside → unconditional guarded-load fault. Same hole: interior
  Never-fold Make* ops + CPPSourceEmitter's second vector-reshape/cast switch
  (slang-emit-cpp.cpp:2000), not mirrored. Fix sketched: propagate fold
  requirement up the single-use path (foldPathInsts set in arm order) +
  mirror the 2 classifications; RE-CHECK test
  `short-circuit-intrinsic-multiref-indirect.slang` (draft hunk + test source
  in /workspace/agent/codex-round1-verdict.md, sha256 285f8521…). r2 =
  approve but did not analyze interior-inst folding (its :337 advisory
  concedes the pass-time-only guarantee); I verified the immediate-edge-only
  gating in source myself — MF-1 stands. **Relayed to fixer 18:12Z with both
  verdict files + retraction of my earlier "PASS — no blockers"** (delivered
  seq 32/34/36 in sess-1794838561533-ei8s6i). Advisories relayed: WGSL
  short-circuit comment factually wrong, block==afterBlock hardening, unused
  armInsts list, movable-loads dedup note; doc nits: side-effect test is
  `CHECK-NOT: &&` not `||`; `areCallArgumentsSideEffectFree` is
  slang-ir-util.cpp:2096. **Do NOT ready-flip until MF-1 is
  reproduced/fixed/rebutted.**
- **MF-1 RESOLVED 18:53–19:35Z (chain converging green).** Fixer pushed
  `1321a9a9f..18e9dd763`: `5d0e11c5d` failing repro
  (`short-circuit-intrinsic-multiref-indirect.slang`, float3/__ldg-adapted —
  scalar loads lower to impure `kIROp_CUDALDG` so the scalar shape would be
  vacuous) + `18e9dd763` the fix (foldPathInsts transitive propagation,
  `isNeverFoldedOnCLikeTargets`, CPP second-switch mirror, all 4 advisories).
  Fixer verify: new test PASS, 6/6 short-circuit, 155/155 tests/cuda, 9/9
  pinned, format clean, CI run 43928995537. **My independent delta CODE_REVIEW
  = approve, no must-fix** (first delta round bridge-aborted at 15 min with no
  server-side verdict; retry completed — verdict of record in
  /workspace/agent/codex-delta-verdict.md sha256 299336f8…; verified: operand-
  membership taint catches readnone-calls-above-loads, Never-table faithful,
  CPP mirror exact, no new hole in post-pass pipeline). Delta advisories
  relayed (fixer's call): `kIROp_LoadReverseGradient` missing from
  isMemoryReadingInst (unreachable pre-emit); emitter-side cross-ref comment
  to close the mirror-coupling loop. **Reviewer 3-pass round 2 at 18e9dd763 =
  APPROVE_WITH_NITS (19:33Z): MF-1 met — A: 0 bugs, Devin: Resolved; apply
  nits w/o another round, then [Fix Report].** Ready-flip cleared from
  recheck side; weekly list per standing policy. Doc-error note: fixer's
  OUTPUT_REVIEW caught the old explanation's `kIROp_Param` (:1517) claim —
  the post-eliminatePhis temp is actually `kIROp_Var` (emitVar :1513); my
  r1/r2 rounds and first verification propagated that error from the doc —
  explanation comment/HTML/PR description corrected at 18e9dd763.
- **19:05Z wrap-up notes (fixer msg):** r2 explanation HTML for head
  `18e9dd763` delivered (same content as GitHub comment 6924417349).
  **Verified erratum, recorded so nobody re-litigates it:** the posted GitHub
  explanation's commit-1 bullet attributes all five early short-circuit
  tests to `bb5b2e311` — actually 3 (and-guard/nested-chain/or-chain) landed
  there, side-effect + multiref landed with the pass commit `f0109e164`
  (git-verified 19:40Z). Fixed in the HTML; the GitHub comment keeps the
  imprecise attribution (r2-attested text, round budget spent) — do NOT
  re-edit or flag it downstream. Also: the [Fix Review Request] was
  initially refused by the critique gate (post-approve /tmp writes needed a
  fresh OUTPUT_REVIEW round) — formally re-dispatched after that round;
  reviewer round-2 APPROVE_WITH_NITS at 18e9dd763 already on record (19:33Z).
  Remaining: fixer applies nits → [Fix Report].
- **ROUND-2 DELTA + REVIEWER r3 20:27–21:01Z — chain green.** Head
  `18e9dd763..678dc566c` (4 commits: f11d2bc2c4 13 clarity items; 163cffd7f5
  **CUDALDG root fix** — `kIROp_CUDALDG` classified pure in
  `IRInst::mightHaveSideEffects` (slang-ir.cpp, the kIROp_Load convention
  group) so the motivating SCALAR guard form reconstructs; 8824d0f30d
  FileCheck hardening + 5 new tests incl. tests/llvm/short-circuit-diamond-
  preserved; 678dc566c emitter fold-veto back-pointer at
  slang-emit-c-like.cpp:1739). Fixer verify: tests/cuda 160/160,
  llvm+numerics+optimization+metal 183/183, format clean; CI 43946678720.
  **My recheck of the global CUDALDG purity change: no blocker** (primary-
  source receipts: isMovableInst own list — CUDALDG not added, dedup/movability
  unchanged; readNone inference traced via slang-ir-propagate-func-properties:
  doesOpReadResourceContents(CUDALDG)=false + immutable-address classifier →
  bare-__ldg wrappers gain __readNone, fold-gate-exempt by intent, safe under
  the Load bad-address convention; DCE removes-only-a-fault; autodiff LII
  hoisting = same speculatable class). Caveat: codex bridge aborted 3 of 4 of
  my delta rounds tonight (18:53/20:28/20:45 rollouts turn_aborted; only
  19:22 completed) — this was my own read, not an independent codex round;
  2 small residuals handed to fixer (exhaustive mightHaveSideEffects consumer
  enumeration; volatile acceptance in isPointerToImmutableLocation).
  **Reviewer round-3 verdict 21:01Z at 678dc566c: APPROVE_WITH_NITS** — every
  r2 priority item verified met, CUDALDG root fix confirmed, Devin Resolved.
  Remaining: fixer applies nits → [Fix Report] → ready-flip weekly list;
  human shepherd (jhelferty-nv) review is the merge gate. r3 explanation
  HTML delivered (same content as GitHub comment 6924417349).
- **[Fix Report] 22:33Z — chain closed at head `f7f8be67f` (git-verified).**
  12 commits, 24 files, +1301/−9 on draft PR #14506. MF-1 + all
  reviewer-round nits applied (3d640e3fb7 nits: precise-veto, ||-side-effect,
  plain-and-chain, CPU behavioral, positive assertion, inert TEST_INPUT drop,
  gate-comment accuracy, isOnFoldPath helper, LoadReverseGradient
  exhaustiveness — the latter was MY delta-round advisory; f7f8be67f0
  name-transfer comment + CPU test dump anchor). Suites: short-circuit 17/17,
  tests/cuda 165/165, llvm+numerics+optimization+metal 183/183, full suite
  12321/12324 (3 pre-existing fp8 PTX-JIT env, control-verified), CI 43961651754.
  Two reviewer claims corrected with evidence (A:381 debug mechanism —
  different ops; :585 constant-fold premise false — emitOr/emitAnd never fold
  there, verified three ways). **One documented disagreement for the human
  shepherd: Devin labels the fold-mirror duplication "Bug (Repo rule)";
  A and C non-blocking; disposition = two-sided sync contract + drift-catching
  tests; shared-helper extraction declined as invasive (follow-up material).**
  My two small residuals (mightHaveSideEffects consumer enumeration;
  volatile acceptance in isPointerToImmutableLocation) remain noted here for
  the shepherd alongside that item. Remaining gates: ready-flip weekly list;
  human shepherd (jhelferty-nv) review = the merge gate. Recheck session
  concurs — no further recheck action; chain record terminal unless review
  feedback reopens it.
- **CHAIN COMPLETE 00:39Z (Nov 17) — head `42746186d`** (15 commits, +1473/−9,
  30 files; round-3 nits f99f8a813+f31da03bb+42746186d landed: Never-list,
  reshape/cast, multi-use-param, -g debug, discriminating read-none test,
  5 comment fixes; CI 43988128030). Two more gate must-fixes caught+fixed
  tonight (false fold-veto mechanism in read-none test comment — the
  multi-ref veto governs args-into-multi-ref-calls, never call-into-user,
  disproven by single-$0 re-probe; 23/23-vs-22/22 count arithmetic).
  **My two residuals CLOSED and verified from source by me:** (a) consumer
  enumeration concurs — 18 `mightHaveSideEffects(` call sites by my grep
  (fixer said 20, methodology artifact); no consumer distinguishes CUDALDG
  from already-pure kIROp_Load except the pass itself, deliberately;
  (b) isPointerToImmutableLocation is strictly type-based — RW-typed
  locations can never pass, only the Immutable access qualifier qualifies,
  RWStructuredBufferGetElementPtr peels to the RW type and rejects, OptiX
  SBT #10188 exception rejected up front with rationale comment
  (slang-ir-util.cpp ~3704). Recheck confirmation sent 00:45Z.
  For the shepherd: Devin's mirror-drift "Repo rule" disagreement stays
  flagged (disposition: two-sided sync contract + drift tests; extraction =
  follow-up); reviewer C's five-part-PR-body point declined with documented
  justification (1500-char delivery-hook cap; substance lives in the
  explanation comment) — shepherd can ask for reformat if they care.
  Only remaining gates: human shepherd (jhelferty-nv) review; weekly
  ready-flip list.
- **UN-PARKED 14:01Z:** gateway auth restored; triager applied all parked artifacts — fresh
  triage 5-bullet posted (issue comment 6918561442, 0 prior comments → fresh-post rule),
  `reproduced` label + Issue Type=Bug applied (Main-verified live via anonymous read 14:05Z:
  label + 1 nv-slang-bot comment, open, no assignees). No fixer draft PR existed yet at 14:01
  (gh search empty) — nothing to fold in. Fixer last report 13:58Z: committed on
  fix/issue-14494, pending codex PLAN_REVIEW r3 + CODE_REVIEW → push + draft PR → peer
  review; it retries the gateway itself at push time, so restored auth needs no nudge.
  Triager passive on the thread; forwards resolution when the fixer reports.
