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

- [slangpy#1214: SlangPy Tests red on every Slang PR since slangpy#1199](slangpy-1214-cuda-cap-ci-latest-slang.md) —
  **an outage of a required check that blocks all Slang merges.** The one-line fix is in slangpy `ci-latest-slang.yml` and belongs to the maintainers. Escalated to the operator 10-08.

- [slang#13536 — add `RTexture*`, warn on `readonly`/`writeonly` on `RWTexture*`](13536-rtexture-deprecate-readonly-rwtexture.md) —
  maintainer-authored and self-assigned feature (step 1 of 2). Triaged and reproduced, P2. The fixer is HELD until the author makes the HLSL choice (reject vs lower with loss); re-chase `rechase-13536-hlsl-choic-afe9` (2026-10-11).

- [slang#13515 — Windows aarch64 builds hit the 120-min limit after #13139 changed the LLVM prebuilt key](13515-windows-aarch64-llvm-prebuilt.md) —
  maintainer-owned infra; no master-ref run seeds the prebuilt. The Windows jobs are noise, but macOS debug aarch64 (in `check-ci` needs) races the 120-min limit and can block merges. Re-chase `rechase-13515-aarch64-ll-6a8c` (2026-10-09).

- [slang#9078 — GLSL→Metal global varying layout-key crash](9078-glsl-metal-global-layout-key.md) —
  **draft PR #13467** (`302264acd3`) implements jhelferty-nv's producer-side design. `[Fix Report]` Partial. Reviewer REQUEST_CHANGES (1/2):
  on CPU/CUDA every global after a user in/out is mis-offset (wrong data, where master asserted). Held on jhelferty-nv's a/b/c; the reviewer recommends (a). No reply at the 10-09 re-chase; next re-chase is `rechase-9078-jhelferty-08b8` (2026-10-12).

- [slang#13220 — CUDA interface dispatch unreachable default, draft PR #13228](13220-cuda-dispatch-unreachable-default.md) —
  held draft `842ea5d5c1`. kaizhangNV accepts the `s_dispatch_*` fix; waiting on their 3-way answer for force-unwrap of `none` `Optional<Interface>`
  (undefined / must trap / must return a value). Re-chase `rechase-13228-kaizhang-a0d7` (2026-10-08).

- [slang#13259 + #12934 — typeflow refined-info re-wrap ICE, PR #12935](13259-typeflow-refined-info-rewrap.md) —
  **MERGED 2026-10-05** (`e6be8dcdd7`). The producer fix in `makeInfoForConcreteType` replaced a disproven consumer `none()` fix. Holds the overclaim timeline and lessons.

- [slang#13436 — DownstreamArgs lost across option levels (linkWithOptions / addTarget)](13436-downstream-args-cross-level.md) —
  triaged + reproduced bug P2, not a regression; #12900's deferred cross-level case. (b) compose-once → **PR #13450** (c527aaf207).
  kaizhangNV resolved C1 on 10-07 (keep append) and marked it READY. [Triage Resolution] 10-08 at 03de207e8c: reviewer R2 APPROVE,
  CI waiting on the falcor gate (0 fail), awaiting maintainer approve/merge. The side finding awaits the operator.
  Re-chase `rechase-13436-precedence-10ab` (2026-10-09).

- [slang#12627 — CUDA masked RWTexture store, draft PR #13363](12627-cuda-masked-rwtexture-store.md) —
  held on jkwak-work's coherency answer (RMW+warning vs CUDA error; warning scope). Peer review complete (2 rounds, 0 bugs),
  `[Fix Report]` in 10-04 at head `b79ae81e23`. Next re-chase `rechase-12627-jkwak-39ce` (2026-10-12); operator re-ping decision pending since 10-07. Follow-ups #13361/#13362/#13364/#13365 not dispatched.

- [slang#13428 — local multi-declarator `j < 2` → E30015 (parser declarator registration)](13428-local-multi-declarator-generic-lookahead.md) —
  regression from #6281. Approach B, plus the DeclGroup hide/unhide miscompile, **#13428 CLOSED 2026-10-07**: PR #13432 was merged by skiminki-nv (`eaf758404f`).
  Sibling #13430 (local struct `decl has no parent`) is fixed in **draft PR #13434** (Approach B, no semantic visitor in local type bodies). The operator un-draft decision is pending (4 asks so far), with a 72h re-chase `rechase-13434-undraft-d613` (2026-10-11). #13433 (interface crash) and #13435 (local-struct static const silent miscompile) are filed and unrouted. Each has a 12h maintainer-reply gate (`i13433-maintainer-gate-6a3c`, `i13435-maintainer-gate-c5d3`).

- [slang#13488: `try` on a non-throwing ctor/subscript not diagnosed](13488-try-non-throwing-ctor-subscript.md) -
  PR #13503 approved (skiminki-nv) + ready, awaiting dshreiner-nv/CI/merge; autodiff-`throws` regression follow-up filed as #13508 (unrouted). Re-chase `rechase-13488-pr13503-73bf` (2026-10-10).
- [slang#13489: accessor errors + throwing call nested in `try`](13489-accessor-errors-nested-try.md) -
  PR #13502 approved and green, awaiting merge. Draft #13514 stalled after the A3 ruling and was nudged 10-08; re-chase `rechase-13489-a3-push-7be1`.
- [slang#13490: `try` in a lambda checked against the enclosing function](13490-lambda-try-error-context.md) -
  triaged bug P2, reproduced, not a regression; Approach A recommended. **HOLD**: no fixer until skiminki-nv (self-assigned)
  asks for a PR. Operator re-asked once on 10-08 (no reply = HOLD); final check `rechase-13490-final-cc58` (2026-10-11).

- [slang#13495: HLSL `class` as a value type (`HLSLClassDecl : StructDecl`)](13495-hlsl-class-value-type.md) -
  **TERMINAL 2026-10-08.** tangent-vector fixed it in their own PR #13497 (merged 10-08 01:38Z, `Fixes #13495`), already open
  before our go/no-go comment. Fixer never briefed; triager stood down; no reschedule. Sibling #13496 (shared parser) has its own Main session.

- [slang#13509: enclosing `==` constraint not applied to a substituted nested assoc type](13509-generic-member-equality-nested-assoc.md) -
  kaizhangNV self-assigned. Triaged and reproduced (bug P2 frontend, not a regression). Fix A prototyped in slang-check-inheritance.cpp and then reverted.
  The fixer stays **HELD** until the assignee asks. Re-chase `rechase-13509-kaizhang-405b` (2026-10-09).

- [slang#13463 — Zed: slangd null config reply disables workspace include search](13463-zed-slangd-null-config.md) —
  triaged + reproduced P2 LSP bug, not a regression, not a #13179 dup. GO via the triager 10-06, amended 10-07 to D (null → default, absent → keep);
  #13216 item 3 is out of scope. **Held draft PR #13475** (`9abe52d5d3`). jkwak-work reassigned the issue to jkiviluoto-nv 10-07 16:01Z, after the PR opened, so bot work is FROZEN; draft kept. Re-chase `rechase-13463-assignee-731d` (10-09).

- [slang#13424 — loops with a constant trip count are not folded at -O3](13424-loop-constant-folding.md) —
  triaged + reproduced, P3 enhancement, SPIR-V only (spirv-opt LoopUnroll declines Slang's loop shape); assigned
  saipraveenb25 10-05. Option A (1-line BlockMerge) go/no-go: final ask sent 10-08 (row 478682), ask budget exhausted →
  HOLD by default. B/C/D need maintainer design; upstream SPIRV-Tools#6930 (abs folding) open. Passive check
  `passive-13424-d14-de2e` (2026-10-22), no further asks.

- [slang#13391 + #8323 — WGSL-via-Tint std140 layout, draft PR #13402](13391-wgsl-tint-std140.md) —
  our gates have passed (review r2 APPROVE_WITH_NITS). Its CI run was deleted (404 as of 10-08), and only un-drafting (B) gets around the bot-dispatch throttle. Waiting on the operator's B/C decision; re-chase every 2 days.

- [slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout](13423-metal-cb-scalar-layout.md) —
  triaged + reproduced, enhancement P2, not a regression (#11578 kept CBs native on purpose). GO on Approach A (explicit
  `ScalarDataLayout` only, IR + reflection; Tier-2 :2869 dropped as unreachable, covered by a unit test) via the triager on 10-03 → **draft PR #13425** (`278cdfaa01`, review r2 APPROVE_WITH_NITS), waiting on a maintainer review and un-draft. Overlaps #13386's store path, and #13386 lands first; re-chase `rechase-13425-maintainer-540f` (10-06); A' is a PR design question. Overlaps draft #13300.

- [slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum](13419-extern-enum-conditional-binding.md) —
  triaged + reproduced, P2, not a regression; link-time folding misses checked initializers. The reporter self-assigned it, so NO-GO and the fixer briefing + prototype are HELD; re-chase `rechase-13419-assignee-b8bd` (2026-10-07).

- [slang#13420 — false-positive E41035 for store/read under the same condition (must-init walk is path-insensitive)](13420-uninit-correlated-conditions.md) —
  triaged + reproduced regression (#11293). jhelferty-nv assigned it to the reporter, so NO-GO and the fixer is stood down; still silent at the 10-07 re-chase; next re-chase `rechase-13420-assignee-3979` (2026-10-14).

- [slang#13409 — Metal groupshared forwarded across barriers; sibling #13412 (all-target pointer roots)](13409-metal-groupshared-barrier-forwarding.md) —
  drafts #13421 (#13409, `c42049e18f`, reviewer jhelferty-nv) and #13431 (#13412, `bf9f3fd05a`, reviewer kaizhangNV) both passed
  internal review; CI has never run (bot dispatches stuck `waiting`). Out-of-scope follow-ups filed 10-06 as #13465 + #13466 (filing only, no fix until both PRs land). Re-chase `rechase-13421-13431-revi-c551` (10-08).

- [slang PR #12136 — lazy autodiff builtins, fork PR approver loop](12136-lazy-autodiff-approver-loop.md) —
  re-pushed 10 times. R10 (`14a2185f`) is only a master merge, so I held it. The R9 real commit was never decided: the approver session has been in cost escalation since Sep 14, and its dispatches go unanswered. The ledger is also unset. All of this is with the operator; re-chase `rechase-12136-approver-c-c050` (2026-10-04).

- [slang#13311 / PR #13312 — nightly stale agentic tests, now 3 docs leftovers](13311-nightly-agentic-stale-tests-docs-leftovers.md) —
  superseded by maintainer #13317, then rescoped by a master merge after jkwak-work's approval was dismissed. It is non-draft and mergeable. The operator's (a)/(b)/(c) decision went unanswered for 3 rounds, so on 10-02 it was HANDED OFF to maintainer review. No re-chase is scheduled.

- [slang#13385 — HLSL `Append` of a non-default-layout matrix struct segfaults](13385-hlsl-append-matrix-layout-segfault.md) —
  triaged + reproduced, P2, not a regression. Fold PUSHED into draft PR #13386 (`8d509354cd`, `Fixes #13385`, review closed
  APPROVE_WITH_NITS); CI is parked on the `falcor-ci` approval gate. Bare-matrix gap #13388 is unrouted, with the go/no-go on the operator.
  Re-chase `rechase-13386-13388-4c40` (2026-10-05).

- [slang#13350 — glsl-module matrix `operator*`/`*=` gated off wgsl+metal (E36107)](13350-glsl-matrix-mul-wgsl-metal-gate.md) —
  triaged + reproduced; not a regression. draft PR #13356 open (7 gates); follow-ups #13355 (62 gated builtins) + #13359 (`filecheck=A,B` checks only A) filed. #13355 + #13359 are assigned to jkwak-work (HOLD unless jkwak asks the bot). #13356 CI gate is with the operator. Re-chase `rechase-13350-13355-r4-d5dc` (2026-10-12).

- [slang#13041 — verify-documented-compiler-version.sh exit 4 (windows-aarch64); bot fix #13042 incomplete](13041-verify-compiler-version-exit4.md) —
  three post-fix hits (two in merge_group, 09-28/29, plus #11709 on 09-30). Diagnostic draft #13352 is waiting on the operator ready-flip and on jvepsalainen-nv choosing exit semantics; re-chase `rechase-13352-exit-seman-440c` (10-03).

- [slang PR #11709 — groupshared parameters by reference](11709-groupshared-param-by-reference.md) —
  owned by slang-fixer and CHANGES_REQUESTED. HELD until the #13339 Ref-split PR lands (jhelferty-nv 10-01: implement on #13339); then it rebases with its P1 fix. Was held on who implements the
  `ParameterPassingMode` Ref split (it would subsume 84fa791 and conflicts with their #13232).
  #13406 (the split) opened 10-02 and was marked ready 10-05. jhelferty-nv requested changes 10-06 (`readonly` modifier), reversed it 10-08, and answered every open question 10-09 02:33Z (A, `r_`/`ro_`/`wo_`, E30119 in `coerce()`); the fixer is implementing it with one push to follow. Re-chase `rechase-13406-r2-9164` (10-09) also catches the merge that lifts the #11709 hold.

- [slang#13348 — inherited field through a property/subscript BoundStorage → E99997 ICE](13348-inherited-field-boundstorage-ice.md) —
  triaged + reproduced; three BoundMember consumers accept VarDecl only and reject InheritanceDecl. The author
  self-assigned it, so NO-GO and no fixer; silent at 10-07 re-chase; next `rechase-13348-assignee-e721` (2026-10-14).

- [slang#13346 — note-suppression tracking issue for maintainer PR #13325](13346-note-suppression-tracking.md) —
  TERMINAL. #13325 merged 2026-09-30 and the maintainer closed #13346 by hand on 2026-10-01; the re-chase is done.

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
  draft PR #13471 (E45002 warning, `pr: non-breaking`) open 2026-10-07; held on kaizhangNV's
  error-vs-warning call + draft-gated CI. Re-chase `rechase-13471-severity-fbf6` (2026-10-14).

- [slang#13330 — array-of-struct shader IO crashes SPIR-V/GLSL](13330-array-of-struct-shader-io.md) —
  triaged; two legalize-pass defects (write-path void store + overlapping input Locations). Fixer
  HELD: external reporter co-assigned; re-chase 1 silent (10-06); re-chase 2 `rechase-13330-second-f513` (2026-10-13).

- [slang-rhi#787 — CUDA↔Vulkan shared-texture missing sync](rhi-787-cuda-vulkan-shared-sync.md) —
  real missing `VK_QUEUE_FAMILY_EXTERNAL` ownership release, not a tolerance flake. Maintainer
  mandated an explicit `handOffShared`/`takeOverShared` API; PR #881 (head `775f522`,
  GPU-CI-green, per-test verified) is NON-DRAFT since 09-28 (jhelferty flipped it); reviewer REQUEST_CHANGES on R4/R5 only. Parked on jhelferty's R4/R5 answer (5907630393, silent 7d as of 10-07; operator asked re reminder) + skallweitNV review (assigned 10-06); #812 closed by jhelferty 09-28; re-chase `rhi-881-review-rechase-755a` (10-11).
  #812 (register-all) held as the alternative.
  - [PR #881 review-round history (condensed)](rhi-787-review-history.md) — how the design converged
    (#812 forks, the rejected `IExternalMemoryQueue` sketch) and the codex/maintainer/reviewer rounds
    resolved; settled history kept out of the live parent.
