---
type: index
title: Slang / slang-rhi chain records
description: Per-chain records for shader-slang issue and PR work driven through this orchestrator
---

# Slang chains

Per-chain state for shader-slang work. One file per issue/PR chain; open the file before
acting on a chain — these hold verified receipts (shas, job ids, log line numbers) that
decay and must be re-read, not remembered.

## Map

- [slang#13220 — CUDA interface dispatch unreachable default, draft PR #13228](13220-cuda-dispatch-unreachable-default.md) —
  held draft `842ea5d5c1`. kaizhangNV accepts the `s_dispatch_*` fix; waiting on their 3-way answer for force-unwrap of `none` `Optional<Interface>`
  (undefined / must trap / must return a value). Re-chase `rechase-13228-kaizhang-a0d7` (2026-10-08).

- [slang#13259 + #12934 — typeflow refined-info re-wrap ICE, PR #12935](13259-typeflow-refined-info-rewrap.md) —
  **MERGED 2026-10-05** (`e6be8dcdd7`). The producer fix in `makeInfoForConcreteType` replaced a disproven consumer `none()` fix. Holds the overclaim timeline and lessons.

- [slang#13436 — DownstreamArgs lost across option levels (linkWithOptions / addTarget)](13436-downstream-args-cross-level.md) —
  triaged + reproduced bug P2, not a regression; #12900's deferred cross-level case. (b) compose-once → **held draft PR #13450**
  (c527aaf207), FROZEN: maintainer-assigned kaizhangNV 10-05 (before the PR opened); C1 precedence open; @-mention OK + side finding await operator.
  Re-chase `rechase-13436-precedence-4252` (2026-10-07).

- [slang#12627 — CUDA masked RWTexture store, draft PR #13363](12627-cuda-masked-rwtexture-store.md) —
  held on jkwak-work's coherency answer (RMW+warning vs CUDA error; warning scope). Peer review complete (2 rounds, 0 bugs),
  `[Fix Report]` in 10-04 at head `b79ae81e23`. Next re-chase `rechase-12627-jkwak-8576` (2026-10-07). Follow-ups #13361/#13362/#13364/#13365 not dispatched.

- [slang#13428 — local multi-declarator `j < 2` → E30015 (parser declarator registration)](13428-local-multi-declarator-generic-lookahead.md) —
  regression from #6281. Approach B, plus the DeclGroup hide/unhide miscompile, is in **draft PR #13432** (`fix/issue-13428-b`), waiting on the reviewer and CI.
  Sibling #13430 (local struct `decl has no parent`) is fixed in **draft PR #13434** (Approach B, no semantic visitor in local type bodies). #13433 (interface crash) and #13435 (local-struct static const silent miscompile) are filed and unrouted. Each has a 12h maintainer-reply gate (`i13433-maintainer-gate-6a3c`, `i13435-maintainer-gate-c5d3`).

- [slang#13424 — loops with a constant trip count are not folded at -O3](13424-loop-constant-folding.md) —
  triaged + reproduced, P3 enhancement, SPIR-V only (spirv-opt LoopUnroll declines Slang's loop shape). Option A (1-line BlockMerge) go/no-go: the 10-04
  card never reached the operator; delivered ask 10-05 (row 453608). HOLD; B/C/D need maintainer design; reporter
  opened upstream SPIRV-Tools#6930 (abs folding). Final re-chase `rechase-13424-ask3-d301` (2026-10-08).

- [slang#13391 + #8323 — WGSL-via-Tint std140 layout, draft PR #13402](13391-wgsl-tint-std140.md) —
  our gates have passed (review r2 APPROVE_WITH_NITS). The Windows x64 Tint rows are held by the bot-CI gate deadlock (run 37055310934, falcor-ci), and the operator has been told a maintainer must rerun it. Re-chase `rechase-13402-tint-ci-001b` (2026-10-04).

- [slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout](13423-metal-cb-scalar-layout.md) —
  triaged + reproduced, enhancement P2, not a regression (#11578 kept CBs native on purpose). GO on Approach A (explicit
  `ScalarDataLayout` only, IR + reflection; Tier-2 :2869 dropped as unreachable, covered by a unit test) via the triager on 10-03 → **draft PR #13425** (`278cdfaa01`, review r2 APPROVE_WITH_NITS), waiting on a maintainer review and un-draft. Overlaps #13386's store path, and #13386 lands first; re-chase `rechase-13425-maintainer-540f` (10-06); A' is a PR design question. Overlaps draft #13300.

- [slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum](13419-extern-enum-conditional-binding.md) —
  triaged + reproduced, P2, not a regression; link-time folding misses checked initializers. The reporter self-assigned it, so NO-GO and the fixer briefing + prototype are HELD; re-chase `rechase-13419-assignee-b8bd` (2026-10-07).

- [slang#13420 — false-positive E41035 for store/read under the same condition (must-init walk is path-insensitive)](13420-uninit-correlated-conditions.md) —
  triaged + reproduced regression (#11293). jhelferty-nv assigned it to the reporter, so NO-GO and the fixer is stood down; re-chase `rechase-13420-assignee-bc0c` (2026-10-07).

- [slang#13409 — Metal groupshared forwarded across barriers; sibling #13412 (all-target pointer roots)](13409-metal-groupshared-barrier-forwarding.md) —
  triaged + reproduced, root at `slang-ir-util.cpp:1442`. Scope widened to (b): strict A plus an emitter guard, one draft PR, fixer building.
  PR #13421 REQUEST_CHANGES(small, 0 bugs); 10-04 G1→narrow, G2 fix, #13412 GO (corrected B). Re-chase `rechase-13421-g1g2-13412-4e79` (2026-10-06).

- [slang PR #12136 — lazy autodiff builtins, fork PR approver loop](12136-lazy-autodiff-approver-loop.md) —
  re-pushed 10 times. R10 (`14a2185f`) is only a master merge, so I held it. The R9 real commit was never decided: the approver session has been in cost escalation since Sep 14, and its dispatches go unanswered. The ledger is also unset. All of this is with the operator; re-chase `rechase-12136-approver-c-c050` (2026-10-04).

- [slang#13311 / PR #13312 — nightly stale agentic tests, now 3 docs leftovers](13311-nightly-agentic-stale-tests-docs-leftovers.md) —
  superseded by maintainer #13317, then rescoped by a master merge after jkwak-work's approval was dismissed. It is non-draft and mergeable. The operator's (a)/(b)/(c) decision went unanswered for 3 rounds, so on 10-02 it was HANDED OFF to maintainer review. No re-chase is scheduled.

- [slang#13385 — HLSL `Append` of a non-default-layout matrix struct segfaults](13385-hlsl-append-matrix-layout-segfault.md) —
  triaged + reproduced, P2, not a regression. Fold PUSHED into draft PR #13386 (`8d509354cd`, `Fixes #13385`, review closed
  APPROVE_WITH_NITS); CI is parked on the `falcor-ci` approval gate. Bare-matrix gap #13388 is unrouted, with the go/no-go on the operator.
  Re-chase `rechase-13386-13388-4c40` (2026-10-05).

- [slang#13350 — glsl-module matrix `operator*`/`*=` gated off wgsl+metal (E36107)](13350-glsl-matrix-mul-wgsl-metal-gate.md) —
  triaged + reproduced; not a regression. draft PR #13356 open (7 gates); follow-ups #13355 (62 gated builtins) + #13359 (`filecheck=A,B` checks only A) filed and left unrouted; CI + #13355 go/no-go are with the operator. Re-chase `rechase-13350-13355-d86c` (2026-10-02).

- [slang#13041 — verify-documented-compiler-version.sh exit 4 (windows-aarch64); bot fix #13042 incomplete](13041-verify-compiler-version-exit4.md) —
  three post-fix hits (two in merge_group, 09-28/29, plus #11709 on 09-30). Diagnostic draft #13352 is waiting on the operator ready-flip and on jvepsalainen-nv choosing exit semantics; re-chase `rechase-13352-exit-seman-440c` (10-03).

- [slang PR #11709 — groupshared parameters by reference](11709-groupshared-param-by-reference.md) —
  owned by slang-fixer and CHANGES_REQUESTED. HELD until the #13339 Ref-split PR lands (jhelferty-nv 10-01: implement on #13339); then it rebases with its P1 fix. Was held on who implements the
  `ParameterPassingMode` Ref split (it would subsume 84fa791 and conflicts with their #13232).
  Draft #13406 (the split) opened 10-02; re-chase `rechase-13406-11709-e638` (2026-10-06).

- [slang#13348 — inherited field through a property/subscript BoundStorage → E99997 ICE](13348-inherited-field-boundstorage-ice.md) —
  triaged + reproduced; three BoundMember consumers accept VarDecl only and reject InheritanceDecl. The author
  self-assigned it, so NO-GO and no fixer; re-chase `rechase-13348-assignee-1a52` (2026-10-07).

- [slang#13346 — note-suppression tracking issue for maintainer PR #13325](13346-note-suppression-tracking.md) —
  WATCH-ONLY. The PR has no Closes-link; re-chase `rechase-13346-close-link-59e9` (2026-10-07).

- [slang#13337 — stray `;` in an interface → E38100 empty-named member](13337-interface-emptydecl-requirement.md) —
  **CLOSED 2026-10-02.** The author's PR #13367 merged, implementing the triaged Approach A (skip `EmptyDecl` in
  the `checkInterfaceConformance` requirement loop). Terminal; no fixer was ever dispatched.

- [slang#13336 — `property override` ICE (decl modifier in a type slot)](13336-override-after-property-ice.md) —
  **CLOSED 2026-10-02.** The author's PR #13366 merged, implementing the triaged Approach A (catch-all → E31201
  `ModifierNotAllowed`). Terminal; no fixer was ever dispatched.

- [slang#13332 — second-order crash on a no_diff value; is higher-order supported?](13332-second-order-nodiff-scope.md) —
  owned by fixer `sess-1789716207340-dwbdoz`. jkwak-work says second-order is unsupported (diagnose, don't crash), which
  contradicts the user guide. The answer likely decides the #13320–#13327 family. Question unanswered after 2 rechases (last
  2026-10-02, not re-armed). saipraveenb25's PR #13360 may overlap. Waiting on the operator's ping-or-hold call.

- [slang#13319 — conflicting link-time exports, order-dependent pick](13319-conflicting-link-time-exports.md) —
  triaged; linker ambiguity diagnostic never implemented. Fixer HELD pending a maintainer
  error-vs-warning decision; re-chase `rechase-13319-severity-595a` (2026-10-06).

- [slang#13330 — array-of-struct shader IO crashes SPIR-V/GLSL](13330-array-of-struct-shader-io.md) —
  triaged; two legalize-pass defects (write-path void store + overlapping input Locations). Fixer
  HELD: external reporter co-assigned; re-chase `rechase-13330-assignee-c133` (2026-10-06).

- [slang-rhi#787 — CUDA↔Vulkan shared-texture missing sync](rhi-787-cuda-vulkan-shared-sync.md) —
  real missing `VK_QUEUE_FAMILY_EXTERNAL` ownership release, not a tolerance flake. Maintainer
  mandated an explicit `handOffShared`/`takeOverShared` API; PR #881 (head `775f522`,
  GPU-CI-green, per-test verified) is NON-DRAFT since 09-28 (jhelferty flipped it); reviewer REQUEST_CHANGES on R4/R5 only. Parked on jhelferty's R4/R5 answer (5907630393, silent as of 10-03) + skallweitNV review; #812 closed by jhelferty 09-28; re-chase `rhi-881-review-rechase-5bfe` (10-07).
  #812 (register-all) held as the alternative.
  - [PR #881 review-round history (condensed)](rhi-787-review-history.md) — how the design converged
    (#812 forks, the rejected `IExternalMemoryQueue` sketch) and the codex/maintainer/reviewer rounds
    resolved; settled history kept out of the live parent.
