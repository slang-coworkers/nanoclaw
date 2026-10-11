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

- [slang#13558 — SlangPy ARM64 segfault draining the current-device stack](13558-slangpy-arm64-current-device-stack-segfault.md) —
  maintainer-owned (jkwak, self-assigned) cross-repo slangpy CI crash. Triaged 10-10 (cmt 6092160118): slangpy lifetime UB, trigger slangpy#1199 test, also hits x86_64 nightly ASan. HELD on jkwak fix A/B/C; re-chase `rechase-13558-device-sta-f70c` (10-14).

- [slang#13107 — static const struct arrays rebuilt per invocation](13107-cuda-static-const-struct-array.md) —
  external P2, all-targets fix in DRAFT PR #13115 (held). The reporter confirmed it on-target on 10-09 and closed their own #13109 in favor of it. Merge is waiting on maintainers picking a direction (tangent-vector, 10-02) and on CI, which has never run (falcor-ci deadlock). Re-chase `chase-13107-design-direc-1be8`.

- [slang#13108 — CUDA by-value struct copies an unread array](13108-cuda-byvalue-struct-copy.md) —
  external enhancement P2, HELD (no bot PR). minco3 closed their PRs #13110/#13178 on 10-09 (NVRTC inliner budget); the issue stays open for the `[noinline]` case. Maintainers split on a Slang pass vs downstream. Operator decision open. Re-chase `rechase-13108-noinline-p-c69e` (10-16).

- [slang#13169 — bwd_diff runtime-bound loop hang](13169-bwd-diff-runtime-loop-hang.md) —
  **CLOSED 2026-10-09** by saipraveenb25 (fixed by #13234). slangpy#1167 still waits on the CUDA grad_sum=320 check (slangpy-fixer). #13301 is tracked by `rechase-slang-13301-huma-3af4`.

- [slang#13555 — `-ignore-capabilities` + case-less `__target_switch` → silent UB](13555-ignore-capabilities-caseless-target-switch.md) —
  external bug P2, long-standing. Draft PR #13564 (head 19b0b2e3ac) in slang-reviewer review; maintainers to decide breaking? and cpp `Buffer<T>.Load` case. Two unfiled pre-existing rc-139 crashes noted.

- [slang#13556 — CUDA/PTX `SampleGrad` via `tex*Grad`](13556-cuda-samplegrad.md) —
  external feature request, P2. Draft PR #13559 reviewed internally; waits on falcor-ci approval + kaizhangNV review. Re-chase `rechase-13556-samplegrad-d1aa` (2026-10-12).
- [slang#13544 — C++14 `'` digit separators](13544-digit-separators.md) —
  external feature request, P3. GO (drafts) on a separate `#if` literal-decoding bug issue (#13545 → draft PR #13546) + finishing `_` for floats (draft PR #13547); CI waits on a falcor-ci approval. `'` is HELD on a maintainer/spec decision. Re-chase `rechase-13544-sep-271e` (2026-10-12).

- [slangpy#1214: SlangPy Tests red on every Slang PR since slangpy#1199](slangpy-1214-cuda-cap-ci-latest-slang.md) —
  **an outage of a required check that blocks all Slang merges.** The one-line fix is in slangpy `ci-latest-slang.yml` and belongs to the maintainers. Escalated to the operator 10-08.

- [slang#13536 — add `RTexture*`, warn on `readonly`/`writeonly` on `RWTexture*`](13536-rtexture-deprecate-readonly-rwtexture.md) —
  maintainer-authored and self-assigned feature (step 1 of 2). Triaged and reproduced, P2. The fixer is HELD until the author makes the HLSL choice (reject vs lower with loss); re-chase `rechase-13536-hlsl-choic-afe9` (2026-10-11).

- [slang#13515 — Windows aarch64 builds hit the 120-min limit after #13139 changed the LLVM prebuilt key](13515-windows-aarch64-llvm-prebuilt.md) —
  maintainer-owned infra; no master-ref run seeds the prebuilt. The Windows jobs are noise, but macOS debug aarch64 (in `check-ci` needs) races the 120-min limit and can block merges. **10-09: master's key `6bf2a1a7` can't be fixed by seeding. The zstd-free reseed publishes under #13526's key `dfeb31f6`, so only merging #13526 unblocks linux x86_64 and the queue.** Re-chase check 2/3 `rechase-13515-check2-4715` (2026-10-11).

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
  awaiting maintainer approve/merge. 10-09 17:10Z kaizhangNV approved the falcor gate and CI is 50/50 green, but the merge queue
  dropped the PR at 19:11Z on its 2 h check timeout (slow macOS); needs a human re-enqueue (operator told 10-10). Side finding held
  (3 asks, no 4th). Re-chase `rechase-13436-requeue-e876` (2026-10-12).

- [slang#12627 — CUDA masked RWTexture store, draft PR #13363](12627-cuda-masked-rwtexture-store.md) —
  held on jkwak-work's coherency answer (RMW+warning vs CUDA error; warning scope). Peer review complete (2 rounds, 0 bugs),
  `[Fix Report]` in 10-04 at head `b79ae81e23`. Next re-chase `rechase-12627-jkwak-39ce` (2026-10-12); operator re-ping decision pending since 10-07. Follow-ups #13361/#13362/#13364/#13365 not dispatched.

- [slang#13554 — CUDA layered `_convert` surface write is an empty stub](13554-cuda-layered-convert-write-stub.md) —
  external, unassigned, P2 bug, reproduced. **GO 2026-10-10** on Approach A (inline `sust.p.a{1d,2d}`, prelude-only) as a draft PR:
  **draft PR #13563** (`508fb1b3b2`), peer review **APPROVE_WITH_NITS** 10-10 06:16Z (0 bugs, 2 gaps); fixups pushed at **e2eaf72e2a** 08:17Z. No GPU CI at that head; the operator
  decides dispatch-at-e2eaf72 vs. approve the old run. Re-chase `rechase-13563-fixups-2-e3ad` (10-11 08:00Z). Couples to #13363's `isConversionAvailable = !isLayered`.

- [slang#13428 — local multi-declarator `j < 2` → E30015 (parser declarator registration)](13428-local-multi-declarator-generic-lookahead.md) —
  **#13428 TERMINAL**: PR #13432 merged 10-07 (`eaf758404f`). Still live: sibling #13430's **draft PR #13434** (`457ae39a0e`); the operator un-draft decision is pending (4 asks), re-chase `rechase-13434-undraft-d613` (2026-10-11). Side findings #13433/#13435 have their own gates.
  - [Decision trail 10-04 → 10-08](13428-13430-decision-trail.md) — A→B, the bootstrap correction, the DeclGroup scope ruling, the stale-branch call, re-chases.

- [slang#13488: `try` on a non-throwing ctor/subscript not diagnosed](13488-try-non-throwing-ctor-subscript.md) -
  **TERMINAL 2026-10-09.** PR #13503 merged 16:29Z (`08d419cbf2`) and #13488 auto-closed. Follow-up #13508 is open and unrouted.
- [slang#13489: accessor errors + throwing call nested in `try`](13489-accessor-errors-nested-try.md) -
  PR 1, #13502, MERGED 10-09 14:38Z. Draft #13514 waits on spec#63 and the stopped reviewer session; re-chase `rechase-13489-gates-ddd2` (2026-10-11).
- [slang#13490: `try` in a lambda checked against the enclosing function](13490-lambda-try-error-context.md) -
  triaged bug P2, reproduced, not a regression; Approach A recommended. **HOLD**: no fixer until skiminki-nv (self-assigned)
  asks for a PR. Operator re-asked once on 10-08 (no reply = HOLD); final check `rechase-13490-final-cc58` (2026-10-11).

- [slang#13495: HLSL `class` as a value type (`HLSLClassDecl : StructDecl`)](13495-hlsl-class-value-type.md) -
  **TERMINAL 2026-10-08.** tangent-vector fixed it in their own PR #13497 (merged 10-08 01:38Z, `Fixes #13495`), already open
  before our go/no-go comment. Fixer never briefed; triager stood down; no reschedule. Sibling #13496 (shared parser) has its own Main session.

- [slang#13509: enclosing `==` constraint not applied to a substituted nested assoc type](13509-generic-member-equality-nested-assoc.md) -
  kaizhangNV self-assigned. Triaged and reproduced (bug P2 frontend, not a regression). Fix A prototyped in slang-check-inheritance.cpp and then reverted.
  The fixer stays **HELD** until the assignee asks. Operator re-asked once on 2026-10-09. Final check `rechase-13509-final-b7c1` (2026-10-12) does not ask again.

- [slang#13463 — Zed: slangd null config reply disables workspace include search](13463-zed-slangd-null-config.md) —
  triaged + reproduced P2 LSP bug, not a regression, not a #13179 dup. GO via the triager 10-06, amended 10-07 to D (null → default, absent → keep);
  #13216 item 3 is out of scope. PR #13475 (head `d23af9c379`). jkwak-work reassigned the issue to jkiviluoto-nv 10-07. **The assignee adopted the PR on 10-08**: un-drafted it, merged master and requested review (jkwak-work + `dev`). **Assignee APPROVED 10-09** and the PR is waiting on a maintainer merge (BLOCKED: reviewDecision empty, Falcor red on d23af9c and likely external). The bot acts only on an explicit human ask. Re-chase `rechase-13463-assignee-731d` (10-12).

- [slang#13424 — loops with a constant trip count are not folded at -O3](13424-loop-constant-folding.md) —
  triaged + reproduced, P3 enhancement, SPIR-V only (spirv-opt LoopUnroll declines Slang's loop shape); assigned
  saipraveenb25 10-05. Option A (1-line BlockMerge) go/no-go: final ask sent 10-08 (row 478682), ask budget exhausted →
  HOLD by default. B/C/D need maintainer design; upstream SPIRV-Tools#6930 (abs folding) open. Passive check
  `passive-13424-d14-de2e` (2026-10-22), no further asks.

- [slang#13391 + #8323 — WGSL-via-Tint std140 layout, draft PR #13402](13391-wgsl-tint-std140.md) —
  our gates have passed (review r2 APPROVE_WITH_NITS). Its CI run was deleted (404 as of 10-08), and only un-drafting (B) gets around the bot-dispatch throttle. Waiting on the operator's B/C decision; re-chase every 2 days.

- [slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout](13423-metal-cb-scalar-layout.md) —
  triaged + reproduced, enhancement P2, not a regression (#11578 kept CBs native on purpose). GO on Approach A (explicit
  `ScalarDataLayout` only, IR + reflection; Tier-2 :2869 dropped as unreachable, covered by a unit test) via the triager on 10-03 → **draft PR #13425** (`278cdfaa01`, review r2 APPROVE_WITH_NITS), waiting on a maintainer review and un-draft. Overlaps #13386's store path, and #13386 lands first; 10-09: CONFLICTING with master #13445 (stable id 907 + module version 34 collision), rebase dispatched to the triager; re-chase `rechase-13425-maintainer-641e` (10-12); A' is a PR design question. Overlaps draft #13300.

- [slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum](13419-extern-enum-conditional-binding.md) —
  triaged + reproduced, P2, not a regression; link-time folding misses checked initializers. The reporter self-assigned it, so NO-GO and the fixer briefing + prototype are HELD; re-chase `rechase-13419-assignee-b8bd` (2026-10-07).

- [slang#13420 — false-positive E41035 for store/read under the same condition (must-init walk is path-insensitive)](13420-uninit-correlated-conditions.md) —
  triaged + reproduced regression (#11293). jhelferty-nv assigned it to the reporter, so NO-GO and the fixer is stood down; still silent at the 10-07 re-chase; next re-chase `rechase-13420-assignee-3979` (2026-10-14).

- [slang#13409 — Metal groupshared forwarded across barriers; sibling #13412 (all-target pointer roots)](13409-metal-groupshared-barrier-forwarding.md) —
  drafts #13421 (#13409, `c42049e18f`, reviewer jhelferty-nv) and #13431 (#13412, `bf9f3fd05a`, reviewer kaizhangNV) both passed
  internal review; CI has never run, and since 10-10 none is pending: the old dispatch runs were deleted in the repo-wide Actions purge, so only an un-draft or a fresh dispatch starts CI. Out-of-scope follow-ups filed 10-06 as #13465 + #13466 (filing only, no fix until both PRs land; #13465 is parked on tangent-vector). Re-chase `rechase-13421-13431-1346-19cf` (10-12).

- [slang PR #12136 — lazy autodiff builtins, fork PR approver loop](12136-lazy-autodiff-approver-loop.md) —
  re-pushed 10 times. R10 (`14a2185f`) is only a master merge, so I held it. The R9 real commit was never decided: the approver session has been in cost escalation since Sep 14, and its dispatches go unanswered. The ledger is also unset. All of this is with the operator; re-chase `rechase-12136-approver-c-c050` (2026-10-04).

- [slang#13311 / PR #13312 — nightly stale agentic tests, now 3 docs leftovers](13311-nightly-agentic-stale-tests-docs-leftovers.md) —
  superseded by maintainer #13317, then rescoped by a master merge after jkwak-work's approval was dismissed. It is non-draft and mergeable. The operator's (a)/(b)/(c) decision went unanswered for 3 rounds, so on 10-02 it was HANDED OFF to maintainer review. No re-chase is scheduled.

- [slang#13385 — HLSL `Append` of a non-default-layout matrix struct segfaults](13385-hlsl-append-matrix-layout-segfault.md) —
  triaged + reproduced, P2, not a regression. Fold PUSHED into draft PR #13386 (`8d509354cd`, `Fixes #13385`, review closed
  APPROVE_WITH_NITS). Its old CI run was deleted and the head has no CI; only un-drafting starts one, which is the operator's call.
  Bare-matrix gap #13388 belongs to jkwak-work (Q4 milestone), unrouted, with the go/no-go on the operator. Re-chase `rechase-13386-13388-c681` (2026-10-12).

- [slang#13350 — glsl-module matrix `operator*`/`*=` gated off wgsl+metal (E36107)](13350-glsl-matrix-mul-wgsl-metal-gate.md) —
  triaged + reproduced; not a regression. draft PR #13356 open (7 gates); follow-ups #13355 (62 gated builtins) + #13359 (`filecheck=A,B` checks only A) filed. #13355 + #13359 are assigned to jkwak-work (HOLD unless jkwak asks the bot). #13356 CI gate is with the operator. Re-chase `rechase-13350-13355-r4-d5dc` (2026-10-12).

- [slang#13041 — verify-documented-compiler-version.sh exit 4 (windows-aarch64); bot fix #13042 incomplete](13041-verify-compiler-version-exit4.md) —
  three post-fix hits (two in merge_group, 09-28/29, plus #11709 on 09-30). Diagnostic draft #13352 is waiting on the operator ready-flip and on jvepsalainen-nv choosing exit semantics; re-chase `rechase-13352-exit-seman-440c` (10-03).

- [slang PR #11709 — groupshared parameters by reference](11709-groupshared-param-by-reference.md) —
  owned by slang-fixer, CHANGES_REQUESTED. HELD until #13406 (the #13339 Ref split) lands; then one rebase-and-rework push with the unpushed P1 fix. jhelferty-nv answered every #13406 question 10-09 02:33Z; the original owner ran out of budget, so the work resumed in a fresh session on `…-11709/13406-resume`. **r5 pushed 10-09 08:49Z** (`4e2603652e`); **round 3 pushed 10-10 05:52Z (`7e683a211b`)**: her five answers, tangent-vector's no-rewrite `const __ref` direction (she deferred to him) and the round-2 review items. Waiting on slang-reviewer round 3 and her re-review. Re-chase `rechase-13406-r5-qs` (10-11) checks for the push and the merge that lifts the hold.
  - [#13406 review-round history](11709-13406-ref-split-review-rounds.md) — tangent-vector's round, the `readonly` rounds and reversal, the 10-09 budget/phantom-session incident.

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
  real missing `VK_QUEUE_FAMILY_EXTERNAL` ownership release, not a tolerance flake. PR #881 implements the maintainer-mandated
  `handOffShared`/`takeOverShared` API; non-draft (jhelferty flipped it 09-28), head `775f522` GPU-CI-green. Parked on jhelferty's
  R4/R5 answer (5907630393) + skallweitNV's review; operator reminder question open. Re-chase `rhi-881-review-rechase-755a` (10-11).
  - [PR #881 review-round history (condensed)](rhi-787-review-history.md) — design convergence (#812 forks, the rejected
    `IExternalMemoryQueue` sketch), the review rounds, and the 09-24 → 10-07 ready/re-chase log.
