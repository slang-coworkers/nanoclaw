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

- [slangpy#1232 — Vulkan module `[[vk::push_constant]]` silent wrong results](slangpy-1232-vulkan-module-push-constant.md) —
  human-filed (albertrodriguezclo) 10-16. Triaged (cmt 6218899535); SlangPy part FIXED → draft PR slangpy#1235 @52e815d6 (CI green, internal review APPROVE_WITH_NITS; waiting on jkwak-work). Upstream filed as slang#13713 → DRAFT PR slang#13724 (E39033, `pr: breaking change`, error-vs-warning open for kaizhangNV; layout parked) + slang-rhi#915. Waiting on the operator: rhi#810 promotion, and fixing the STAGE_ALL overlap now.
- [slang#13518 — MemoryOrder validation](13518-memory-order-validation.md) —
  bot-triaged missing diagnostic. DRAFT PR #13541 @f961d32f0b; internal review done (R2 APPROVE_WITH_NITS). HELD on maintainer Q1 (error/warning, which decides the breaking label) and Q2 (CAS Release/Acquire); CI is waiting on falcor-ci approval. jkwak-work assigned. Coupled to #13519.
- [slang#13591 R-series — contributor standards for AI assistants](13591-authorship-rules-r-series.md) —
  szihs's umbrella + R1–R10 sub-issues (#13592–#13602), self-assigned, each with its own PR. Not dispatched.
- [slang#13631 — `workgroupUniformLoad` synchronizes only on WGSL](13631-workgroup-uniform-load-barrier.md) —
  human-filed (albertrodriguezclo) cross-target race: plain load off WGSL. Triaged 10-15 (cmt 6193295113), P2. DRAFT PR #13659 shipped @c136bcb after 2 REQUEST_CHANGES rounds (cap); unreviewed `specializeStageSwitch` change; gaps filed #13675 + #13683, both OWNED by this chain (dispatch nothing on their webhooks). PARKED on shepherd kaizhangNV accepting the semantics (also answers reporter cmt 6194249872). CI approval-gated. Re-check `rechase-13631-pr13659-se-8806` 10-20.
- [slang#13634 — WGSL BAB `Load<half>` → E56103](13634-wgsl-bab-load-half-int16.md) —
  human-filed (albertrodriguezclo) bug: byte-address `Load<half>` lowers via a u16 intermediate WGSL rejects (+ lowerBitCast 2nd producer). Triaged 10-15 13:42Z P2. Fixer STOOD DOWN 17:33Z; reporter PR #13647 covers loads. Stores are out of scope (#13661). Gaps checked 17:49Z: gap 1 (PR takes element 0 without masking the neighbour half; GPU run 10-16: 336/336 correct on L40S → defensive nit) → #13647 review input; gaps 2/3 (struct `bit_cast`, any-value marshalling with half) pre-existing. **All three: unfiled, operator call** (asked once 10-15; never re-ask). The one-shot fired 10-16 18:00Z with no change and was not re-armed. Resumes on #13647/#13634 webhooks.
- [slang#13661 — WGSL BAB `Store<half>` rejected; atomic view?](13661-wgsl-bab-store-half-atomic-view.md) —
  human-filed (albertrodriguezclo) design question, the store follow-up to #13634/#13647. Triaged 10-15 17:15Z (cmt 6197941951), P2, reproduced. PARKED on maintainer choice of (a)/(b)/(c); re-check `i13661-recheck-6b22` 10-22. Unfiled Metal sub-word store hypothesis is waiting on the operator.
- [slang#13654 — Metal `StructuredBuffer<S>` with a `Texture2D` field aborts slangc](13654-metal-structuredbuffer-texture-field-abort.md) —
  human-filed (albertrodriguezclo) Metal ICE: texture method on a structured-buffer element field drops its `this` operand → release assert `slang-intrinsic-expand.cpp:406`. Triaged 10-15 15:03Z (cmt 6195242328), P2: Metal wrongly exempt from E38204 + `legalizeResourceTypes` leaves SB<tuple> simple; fixer moved the decision into the legalizer (E38204 at `slang-legalize-types.cpp:1416`, validator unchanged) → DRAFT PR #13681 @87c393db2e, `pr: non-breaking`, jkwak-work assigned; triage resolved 10-16 07:48Z. PARKED on maintainer review + operator (ready/CI approval 38866727586; GPU A/B re-verified 10-16 (L40S, no fix-only failures); file-or-leave 2 unfiled: `uniform Material*` assert, validator struct-field location). Re-check `rechase-13654-pr13681-2044` 10-18. #12529 ruled out.
  - [#13654 triage, fix rounds and GPU re-verification (history)](13654-history-triage-fix-gpu.md) — dispatch, [Triage] A+C, the legalizer-side re-plan + newly-rejected-shapes inventory, R1/R2, [Fix Report], [Triage Resolution], L40S A/B.
- [slang#13643 — WGSL address-space specialization re-clones its own clones](13643-wgsl-address-space-specialization-reclone.md) —
  human-filed (albertrodriguezclo) WGSL code-size bug: `specializeAddressSpace` keys its cache on the current callee, so per-call-site revisits re-clone (N identical copies). Triaged 10-15 P2 (shared pass, not WGSL-only). Fix = reporter PR #13648 (verified by triager; CI awaiting fork approval); watch-only, re-check 10-22. #12563 conflicts.
- [slang#13721 — `extension N::T` body can't see `N`'s members](13721-extension-namespace-qualified-target-lookup.md) —
  human-filed (skiminki-nv) language-semantics question. Triaged 10-16 19:26Z (cmt 6223072037), P2, reproduced; lookup is lexical-only. PARKED on a maintainer pick of A/A′/B/C (B conflicts with #11577); no fixer. Re-check `t-5f0897` 10-23.
- [slang#13688 — Metal inline RayQuery fixed tags (no curves / multi-level)](13688-metal-rayquery-curves-multilevel.md) —
  human-filed (albertrodriguezclo) Metal feature/design question (tags from type vs inferred; curve accessors). Triaged 10-16 08:03Z (cmt 6210949750) Feature/P3; #12691 doesn't cover inline queries. PARKED on kaizhangNV direction; re-check t-2c3ce2 10-23. Sibling #13690.
- [slang#13690 — Metal RayQuery → `intersector<>` lowering?](13690-metal-rayquery-intersector.md) —
  human-filed (albertrodriguezclo) Metal design question (candidate-free RayQuery → `intersector<>`; reuse one `intersection_query`). Triaged 10-16 07:46Z (cmt 6210678998), Feature/P3. PARKED on kaizhangNV (#11296 scope; explicit API vs recognition pass; reuse pass vs doc). No fixer. Re-check `t-b12d01` 10-23. Sibling #13688.
- [slang#13642 — slang-wasm `createSession` macros/search paths/options](13642-slang-wasm-createsession-options.md) —
  human-filed (albertrodriguezclo) feature request: wasm `createSession` takes only a target. Triaged 10-15 (cmt 6193362000), Feature/P2. Reporter then opened PR #13651 (shape A, `Fixes #13642`, fork-CI action_required), so the shape decision now sits in maintainer review; re-check `rechase-13642-wasm-sessi-cbbe` 10-22.
- [slang#13662 — slang-wasm `loadModuleFromIRBlob` + `Module.serialize`](13662-slang-wasm-load-module-ir-blob.md) —
  human-filed (albertrodriguezclo) feature request: wasm offers only `loadModuleFromSource`. Triaged 10-15 17:14Z Feature/P3; dup of older #8744. Reporter PR #13663 is the fix (watch-only, fork-CI action_required); issue post held for operator GO; re-check t-ea7eeb 10-22.
- [slang#13673 — `sign` in `slang.numerics` (`ISignedNumeric.IntegerSign`)](13673-numerics-sign-requirement.md) —
  tangent-vector feature proposal, self-assigned. TRIAGED 10-16 (cmt 6210602589), P2; PARKED on tangent-vector, fixer HELD (design-RFC). Prereq: int-matrix conformances; CoopVec lacks core `sign`. Triager re-check t-6d276c 10-23.
- [slang#13676 — SPIR-V `float(sign(x))` redundant FToS→SToF round-trip](13676-spirv-sign-float-int-float-roundtrip.md) —
  human-filed (HildarTheDorf) missed optimization: SPIR-V `sign` on float is opaque `spirv_asm` FSign+ConvertFToS, so `float(sign(x))` round-trips. Triaged 10-15 20:17Z (cmt 6201414239), P3; parked on maintainer OK of approach A; 2 operator decisions (GO A / file GLSL `sign`→int bug).
- [slang#13664 — `getBuiltinModuleSource` null-deref without embedded source](13664-getbuiltinmodulesource-null-without-embedded-source.md) —
  human-filed (albertrodriguezclo) bug: null blobs dereferenced when `SLANG_EMBED_CORE_MODULE_SOURCE=OFF`. Triaged 10-15 17:26Z (cmt 6198150215), P3. The fix is reporter PR #13665 (CI green, but it leaves the compile path silently empty; follow-up B suggested). Parked on shepherd kaizhangNV; triager re-check `t-3606e0` 10-19.
- [slang#13635 cluster — WGSL NaN/Inf const-expressions Tint rejects](13635-wgsl-nonfinite-const-expr-cluster.md) —
  human-filed #13635 fixed by reporter PR #13645 (bot stood down). Bot follow-ups all review-complete drafts (10-16 11:37Z): #13657 → #13670, #13658 → #13669 (NVIDIA Dawn crash fixed with bit-pattern helpers), #13672 → #13680; all held for operator un-draft. Parked: #13671 (maintainer design, re-check 10-17), #13682 (P3 perf).
- [slang#13639 — WGSL push constants as `var<immediate>`](13639-wgsl-push-constant-immediate.md) —
  human-filed (albertrodriguezclo). Triaged 10-15 (cmt 6193417129); fix owned by reporter's community PR #13646 (shepherd jkwak-work); slang-fixer held, no PR. PARKED on operator (gap comment / follow-up diagnostics PR); re-check `rechase-13639-pr13646-cdc2` 10-17. Follow-on design question #13666 (reporter, 10-15 17:05Z; arrays/matrices in `var<immediate>`) → slang-triager. Side segfault filed as #13656 (bot, unrouted; `__constref P` ← `ConstantBuffer<P>`, typeflow BorrowIn null cast).
- [slang#13640 — WGSL `diagnostic(...)` directive emission](13640-wgsl-diagnostic-directive.md) —
  human-filed (albertrodriguezclo) feature request: Tint rejects subgroup ops in divergent flow; asks for a way to emit
  `diagnostic(off, subgroup_uniformity)`. Triaged 10-15 (cmt 6193536016), P2, reproduced; recommends a compiler option (A).
  HANDED OFF 10-15: jkwak-work assigned, reporter opening an option-A PR; re-check `recheck-13640-diag-surfa-f817` 10-22.
- [slang#13617 — WGSL fragment `SV_PrimitiveID`](13617-wgsl-fragment-primitive-id.md) —
  human-filed (rhendry) feature request: WGSL marks PrimitiveID unsupported (`isUnsupported` in `LegalizeWGSLEntryPointContext`); wgpu has `primitive_index`. Triaged 10-14 (cmt 6161247791), P2; GO on Approach A → DRAFT PR #13619 @b5340af7ab, triage resolved 10-14 10:18Z (internal R2 APPROVE_WITH_NITS); CI at priority gate; parked on maintainer + operator ready; re-chased 10-15 (no human activity; jkwak-work milestoned #13617 Q4 2026; operator asks re-asked once), next re-chase 10-17 10:30Z; jkwak-work assigned. Side ICE (WGSL nested-struct `int` SV field, E99999) filed as #13620; global-`in` SV stage-check gap filed as #13622 (both bot, unrouted; their issue_opened webhooks are self-echoes). SV_WaveLaneIndex no-`enable subgroups` side note unfiled, operator call.
- [slang#13590 — WGSL emits `bool` members in `var<uniform>` structs](13590-wgsl-bool-uniform-host-shareable.md) —
  human-filed (j8asic) WGSL bug: bool in host-shareable address spaces isn't lowered to int (SPIR-V-only `lowerLeafLogicalType` case). slangpy#787 (same author) works around it with `uniform uint`. Triaged 10-13 (cmt 6144341398), P2, 3 gaps; fixer released for draft PR. Triage resolved 10-13 20:49Z; HELD on kaizhangNV review + CI. 2 follow-ups unfiled (push-constant no-@binding; bool2 varyings), operator call. DRAFT PR #13607 @7851898586 (10-13, internal review R1 APPROVE_WITH_NITS applied), PR assignee kaizhangNV; issue reassigned to jkwak-work + milestone Q4 2026 (10-14). CI not run (draft). Unchanged re-chases: 10-14, 10-15, 10-16 → **PARKED** 10-16 in the task-hygiene parked-chain register (no re-chase armed); held on kaizhangNV/jkwak-work review + CI approval gate 38462553148.
- [slang#13571 — WGSL matrix negation emitted as `matNxM<f32>(0) - m`](13571-wgsl-matrix-negation.md) —
  human-filed (andy-slater) WGSL emit bug (`kIROp_Neg` matrix `T(0)-x`). Triaged 10-11 (cmt 6113276208), P2; triage resolved 10-12; draft PR #13572 @46ac7f64a7 awaiting jkwak-work, CI gated. 4 follow-ups unfiled (operator call). Re-chase `rechase-13571-wgsl-matne-de5e` (10-13).
- [slang#13558 — SlangPy ARM64 segfault draining the current-device stack](13558-slangpy-arm64-current-device-stack-segfault.md) —
  **TERMINAL, closed 10-12.** jkwak fixed it in slangpy#1219 (`~Device()` erases its stack entries, merged as fb1bca1). The 10-14 post-fix nightly ASan passes test_push_pop_current_device; the remaining red is unrelated.
- [slang-rhi#876 — in-flight command buffers retain the device](slang-rhi-876-inflight-cmdbuf-device-retention.md) —
  external lifetime-cycle bug, handed off to maintainer PR #884 (MERGED 10-01, no closing ref). #880 (jkwak, closes #876) still open. Triager dispatched 10-14 to verify + post resolution suggesting close; re-check `rechase-slang-rhi-876-re-b4fe` (10-15).

- [slang#12609 — bulk-copy dyn-interface packing, PR #12875](12609-bulkcopy-dyn-interface-packing.md) —
  waiting on maintainer jvepsalainen-nv (re-review + Windows-run question). The green CI run was deleted in the Actions purge, so the head has no CI; a rebase is offered as an operator option. Re-chase `rechase-12875-maint-a8d0` (10-15).

- [slang#13107 — static const struct arrays rebuilt per invocation](13107-cuda-static-const-struct-array.md) —
  external P2, all-targets fix in DRAFT PR #13115 (held). The reporter confirmed it on-target on 10-09 and closed their own #13109 in favor of it. jkwak-work (assigned reviewer) is assessing side effects (10-15); narrowed fix `a6d49136bf` is built and checks out (local, unpushed); blocked on the fixer session's cost ceiling (operator). tangent-vector's 10-02 direction question is still open; CI has never run. Re-chase `chase-13107-design-direc-941b`.

- [slang#13108 — CUDA by-value struct copies an unread array](13108-cuda-byvalue-struct-copy.md) —
  external enhancement. **Closed for the bot 10-14**: assignee jkwak-work deprioritized it and rejected the heuristic field-promotion approach. minco3's draft #13583 is still open, and its fate is the maintainers' call. Final check `rechase-13108-noinline-p-c69e` done 10-16: #13583 still an open draft, decision not reversed; no further re-checks.

- [slang#13169 — bwd_diff runtime-bound loop hang](13169-bwd-diff-runtime-loop-hang.md) —
  **CLOSED 2026-10-09** by saipraveenb25 (fixed by #13234). slangpy#1167 still waits on the CUDA grad_sum=320 check (slangpy-fixer). #13301 waits on saipraveenb25's answer to our 10-09 guard-PR ask (silent as of 10-14); it is tracked by `rechase-slang-13301-huma-d01c` (10-17).

- [slang#13555 — `-ignore-capabilities` + case-less `__target_switch` → silent UB](13555-ignore-capabilities-caseless-target-switch.md) —
  external bug P2, long-standing. Draft PR #13564 (head eac83d94ed, round-2 fixes pushed). Round-2 review done; [Triage Resolution] 10-15. PARKED on maintainers (breaking? cpp `Buffer<T>.Load` case) + operator (ready/merge). ⚠ Opcode 909 / module version 36 collide with draft #13425. Re-chase `rechase-13564-maintainer-b2f8` (10-22).

- [slang#13556 — CUDA/PTX `SampleGrad` via `tex*Grad`](13556-cuda-samplegrad.md) —
  **MERGED 2026-10-15** (#13559, combined-sampler only; separate-sampler stays E36107 per jkwak-work). Possible unfiled follow-up: separate-sampler `Sample`/`SampleLevel` on CUDA.
- [slang#13544 — C++14 `'` digit separators](13544-digit-separators.md) —
  **CLOSED 10-13 by the reporter (completed).** tangent-vector refused `'` ("`_` … is already supported"), and skiminki-nv and the reporter agreed. Still live: draft #13547 (float `_`, `Part of #13544`), blocked until skiminki-nv lifts it, though they suggested this exact scope; and draft #13546 (`#if` decoding, `Fixes #13545`). CI on both waits on falcor-ci. Final re-chase `rechase-13544-tv-6b49` ran 10-16 16:00Z: nothing had changed, and the operator never answered. **PARKED on an inbound; no further re-chase.**
  - [#13544 triage, drafts, maintainer rounds and close (history)](13544-history-triage-to-close.md) — disposition, #13545/#13546/#13547, skiminki-nv deferral + block, tangent-vector's refusal, reporter close, final re-chase.

- [slangpy#1214: SlangPy Tests red on every Slang PR since slangpy#1199](slangpy-1214-cuda-cap-ci-latest-slang.md) —
  **an outage of a required check that blocks all Slang merges.** The one-line fix is in slangpy `ci-latest-slang.yml` and belongs to the maintainers. Escalated to the operator 10-08.

- [slang#13536 — add `RTexture*`, warn on `readonly`/`writeonly` on `RWTexture*`](13536-rtexture-deprecate-readonly-rwtexture.md) —
  maintainer-authored and self-assigned feature (step 1 of 2). Triaged and reproduced, P2. The fixer is HELD until the author makes the HLSL choice (reject vs lower with loss); re-chase `rechase-13536-hlsl-choic-afe9` (2026-10-11).

- [nanoclaw PR: expired falcor gate → `gate_expired`](ci-babysitter-gate-expired-pr.md) — the babysitter's sweep-gate fix is ready on a local branch, not pushed, waiting on the operator's OK. The 10-16 prompt timed out.
- [Yield-retry bot starved by `waiting` runs](ci-retry-yielded-bot-starved-by-waiting-runs.md) — `retry-yielded-bot-ci.py` counts approval-parked `waiting` runs as active (105 of them, oldest 09-15), so it never retries yielded bot CI. Maintainer decision, raised with the operator 10-12.
- [Actions run history gap 10-01→10-07](actions-run-history-gap-2026-10-01-07.md) — oldest-first deletion of workflow runs and their check-runs, 10-01 20:05Z to 10-09 ~16Z. It moved about 1h of history per hour, paused from ~10-14 16Z for about 2 days, then **resumed by 10-16 22Z** (front about 10-10 00Z). Cause unknown; operator asked 10-12, 10-13 and 10-16. PRs with heads in the window look like `no-ci`.

- [slang#13515 — LLVM prebuilt key change after #13139 (cold builds, 120-min cancels)](13515-windows-aarch64-llvm-prebuilt.md) —
  **TERMINAL 2026-10-12.** #13526 merged at 09:07Z (`f7e14a1a62`) and #13515 auto-closed. Master's key is now `b3ad5163`, with prebuilts live. 8 human fork PRs still need a master merge from their authors. Lessons: a comment edit moves the key, and a seed counts only once a consumer has linked against it.

- [slang#9078 — GLSL→Metal global varying layout-key crash](9078-glsl-metal-global-layout-key.md) —
  **draft PR #13467** (`302264acd3`) implements jhelferty-nv's producer-side design. `[Fix Report]` Partial. Reviewer REQUEST_CHANGES (1/2):
  on CPU/CUDA every global after a user in/out is mis-offset (wrong data, where master asserted). Held on jhelferty-nv's a/b/c; the reviewer recommends (a). No reply at the 10-09 or 10-12 re-chases. The operator was asked 10-12 about pinging jvepsalainen-nv; next re-chase is `rechase-9078-jhelferty-602a` (2026-10-15).

- [slang#13220 — CUDA interface dispatch unreachable default, draft PR #13228](13220-cuda-dispatch-unreachable-default.md) —
  held draft `842ea5d5c1`. kaizhangNV accepts the `s_dispatch_*` fix; waiting on their 3-way answer for force-unwrap of `none` `Optional<Interface>`
  (undefined / must trap / must return a value). Re-chase `rechase-13228-kaizhang-a0d7` (2026-10-08).

- [slang#13259 + #12934 — typeflow refined-info re-wrap ICE, PR #12935](13259-typeflow-refined-info-rewrap.md) —
  **MERGED 2026-10-05** (`e6be8dcdd7`). The producer fix in `makeInfoForConcreteType` replaced a disproven consumer `none()` fix. Holds the overclaim timeline and lessons.

- [slang#13436 — DownstreamArgs lost across option levels (linkWithOptions / addTarget)](13436-downstream-args-cross-level.md) —
  **CLOSED 10-12**: PR #13450 merged by kaizhangNV (e4d92bf0bb), issue auto-closed. Side finding held, unfiled (explicit operator A only).

- [slang#12627 — CUDA masked RWTexture store, draft PR #13363](12627-cuda-masked-rwtexture-store.md) —
  held on jkwak-work's coherency answer (RMW+warning vs CUDA error; warning scope). Reconciled with #13563 on 10-15 (head `6f4e01b249`,
  codes now E56020–E56022), then made `dirty` again by #13537. The fixer is holding, and the operator's merge-again/re-ask decision is open.
  Next re-chase `rechase-12627-13537-conf-14f1` (2026-10-18 08:00Z). Follow-ups #13361/#13362/#13364/#13365 not dispatched.

- [slang#13554 — CUDA layered `_convert` surface write is an empty stub](13554-cuda-layered-convert-write-stub.md) —
  **TERMINAL 2026-10-15**: PR #13563 was merged by jkwak-work (`788be3144e`), and the issue closed COMPLETED. GPU CI proved `sust.p.a{1d,2d}` on hardware.
  The stale #13363 rule is followed up by the #12627 chain.

- [slang#13428 — local multi-declarator `j < 2` → E30015 (parser declarator registration)](13428-local-multi-declarator-generic-lookahead.md) —
  **#13428 TERMINAL**: PR #13432 merged 10-07 (`eaf758404f`). Still live: sibling #13430's **draft PR #13434** (`457ae39a0e`); the operator un-draft decision is pending (4 asks), re-chase `rechase-13434-undraft-d613` (2026-10-11). Side findings #13433/#13435 have their own gates.
  - [Decision trail 10-04 → 10-08](13428-13430-decision-trail.md) — A→B, the bootstrap correction, the DeclGroup scope ruling, the stale-branch call, re-chases.

- [slang#13488: `try` on a non-throwing ctor/subscript not diagnosed](13488-try-non-throwing-ctor-subscript.md) -
  **TERMINAL 2026-10-09.** PR #13503 merged 16:29Z (`08d419cbf2`) and #13488 auto-closed. Follow-up #13508 has its own record (below).
- [slang#13508: `[Differentiable]` + `throws` → E38105 ×3 / E99997](13508-differentiable-throws-e38105.md) -
  10-14 the assignee, saipraveenb25, first proposed matching error types. After the triager prototyped that, he switched to *diagnosing* `[Differentiable]` + `throws`. The triager posted an E38038 proposal (16:48Z). **Parked on Sai:** two scope questions plus a PR go-ahead. Re-chase `rechase-13508-sai-fix-0eea` (10-16).
- [slang#13489: accessor errors + throwing call nested in `try`](13489-accessor-errors-nested-try.md) -
  **TERMINAL 2026-10-16.** #13502 merged 10-09, and #13514 merged 10-16 10:04Z after its in-place try-coverage fix cleared the Windows-Debug stack overflow; the issue auto-closed.
- [slang#13491: one `try` covers every throwing call in its operand](13491-try-covers-nested-calls.md) -
  design-gated feature, triage NO-GO; **PARKED** on maintainers (coverage model + redundant-nested-`try` policy), waiting on Yong. spec#63 (merged 10-14) is the current narrow rule, not a decision. Re-chase `rechase-13491-try-covera-ad54` (10-21).
- [slang#13490: `try` in a lambda checked against the enclosing function](13490-lambda-try-error-context.md) -
  triaged bug P2, reproduced, not a regression; Approach A recommended. **HOLD**: no fixer until skiminki-nv (self-assigned)
  asks for a PR. Operator re-asked once on 10-08, no reply; the final check on 10-11 found no change. No timer left: it resumes only on a human comment or an operator GO/DROP.

- [slang#13495: HLSL `class` as a value type (`HLSLClassDecl : StructDecl`)](13495-hlsl-class-value-type.md) -
  **TERMINAL 2026-10-08.** tangent-vector fixed it in their own PR #13497 (merged 10-08 01:38Z, `Fixes #13495`), already open
  before our go/no-go comment. Fixer never briefed; triager stood down; no reschedule. Sibling #13496 (shared parser) has its own Main session.

- [slang#13509: enclosing `==` constraint not applied to a substituted nested assoc type](13509-generic-member-equality-nested-assoc.md) -
  kaizhangNV self-assigned. Triaged and reproduced (bug P2 frontend, not a regression). Fix A prototyped in slang-check-inheritance.cpp and then reverted.
  The fixer stays **HELD** until the assignee asks. Operator re-asked once on 2026-10-09 with no answer. Final check on 2026-10-12 found no change; no more timers or asks, and only a webhook or an operator GO/DROP resumes it.

- [slang#13463 — Zed: slangd null config reply disables workspace include search](13463-zed-slangd-null-config.md) —
  **MERGED 2026-10-12** (PR #13475, `fac7213eba`; the assignee jkiviluoto-nv adopted the bot PR, verified it in real Zed, and merged it). Terminal record + lessons.

- [slang#13424 — loops with a constant trip count are not folded at -O3](13424-loop-constant-folding.md) —
  triaged + reproduced, P3 enhancement, SPIR-V only (spirv-opt LoopUnroll declines Slang's loop shape); assigned
  saipraveenb25 10-05. Option A (1-line BlockMerge) go/no-go: final ask sent 10-08 (row 478682), ask budget exhausted →
  HOLD by default. B/C/D need maintainer design; upstream SPIRV-Tools#6930 (abs folding) open. Passive check
  `passive-13424-d14-de2e` (2026-10-22), no further asks.

- [slang#13704 — WGSL forced scalar layout on entry-point uniforms](13704-wgsl-forced-scalar-entry-point-uniforms.md) —
  triaged 10-16, parked for reporter's patch; must use `isWGPUTarget` (couples to #13402).
- [slang#13391 + #8323 — WGSL-via-Tint std140 layout, draft PR #13402](13391-wgsl-tint-std140.md) —
  our gates have passed (review r2 APPROVE_WITH_NITS). Its CI run was deleted (404 as of 10-08), and only un-drafting (B) gets around the bot-dispatch throttle. Waiting on the operator's B/C decision; re-chased weekly since 10-12 (8 asks unanswered).

- [slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout](13423-metal-cb-scalar-layout.md) —
  triaged + reproduced, enhancement P2, not a regression (#11578 kept CBs native on purpose). GO on Approach A (explicit
  `ScalarDataLayout` only, IR + reflection; Tier-2 :2869 dropped as unreachable, covered by a unit test) via the triager on 10-03 → **draft PR #13425** (`278cdfaa01`, review r2 APPROVE_WITH_NITS), waiting on a maintainer review and un-draft. Overlaps #13386's store path, and #13386 lands first; 10-09: CONFLICTING with master #13445 (stable id 907 + module version 34 collision), rebase dispatched to the triager; re-chase `rechase-13425-maintainer-641e` (10-12); A' is a PR design question. Overlaps draft #13300.

- [slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum](13419-extern-enum-conditional-binding.md) —
  triaged + reproduced, P2, not a regression; link-time folding misses checked initializers. NO-GO (the reporter is the assignee). **Assignee PR #13487** (Approach A, opened 10-07) is open with no human review and no CI runs on its head; the fixer briefing is superseded. Re-chase `rechase-13419-pr13487-137f` (2026-10-21).

- [slang#13420 — false-positive E41035 for store/read under the same condition (must-init walk is path-insensitive)](13420-uninit-correlated-conditions.md) —
  triaged + reproduced regression (#11293). jhelferty-nv assigned it to the reporter, so NO-GO and the fixer is stood down; on 10-09 the assignee opened PR #13543 (Fixes #13420; open, 5 CI failures as of 10-14); next re-chase `rechase-13420-pr13543-4d22` (2026-10-21).

- [slang#13409 — Metal groupshared forwarded across barriers; sibling #13412 (all-target pointer roots)](13409-metal-groupshared-barrier-forwarding.md) —
  drafts #13421 (#13409, `c42049e18f`, reviewer jhelferty-nv) and #13431 (#13412, `bf9f3fd05a`, reviewer kaizhangNV) both passed
  internal review; CI has never run, and since 10-10 none is pending: the old dispatch runs were deleted in the repo-wide Actions purge, so only an un-draft or a fresh dispatch starts CI. Out-of-scope follow-ups filed 10-06 as #13465 + #13466 (filing only, no fix until both PRs land; #13465 is parked on tangent-vector). Re-chase `rechase-13421-13431-1346-b02d` (10-16).
  - [#13409/#13412 decisions, review rounds and re-chase log](13409-history-decisions-and-rechases.md) — Approach A + emitter guard, G1/G2, corrected B + escape check, finding 3 per target, the 10-05 lost reports, #13465/#13466 filings and tangent-vector's `inout` ruling, 10-08→10-14 re-chases.

- [slang PR #12136 — lazy autodiff builtins, fork PR approver loop](12136-lazy-autodiff-approver-loop.md) —
  re-pushed 10 times. R10 (`14a2185f`) is only a master merge, so I held it. The R9 real commit was never decided: the approver session has been in cost escalation since Sep 14, and its dispatches go unanswered. The ledger is also unset. All of this is with the operator; re-chase `rechase-12136-approver-c-c050` (2026-10-04).

- [slang#13311 / PR #13312 — nightly stale agentic tests, now 3 docs leftovers](13311-nightly-agentic-stale-tests-docs-leftovers.md) —
  superseded by maintainer #13317, then rescoped by a master merge after jkwak-work's approval was dismissed. It is non-draft and mergeable. The operator's (a)/(b)/(c) decision went unanswered for 3 rounds, so on 10-02 it was HANDED OFF to maintainer review. No re-chase is scheduled.

- [slang#13385 — HLSL `Append` of a non-default-layout matrix struct segfaults](13385-hlsl-append-matrix-layout-segfault.md) —
  triaged + reproduced, P2, not a regression. Fold PUSHED into draft PR #13386 (`8d509354cd`, `Fixes #13385`, review closed
  APPROVE_WITH_NITS). Its old CI run was deleted and the head has no CI; only un-drafting starts one, which is the operator's call.
  Bare-matrix gap #13388 belongs to jkwak-work (Q4 milestone), unrouted, with the go/no-go on the operator. Re-chase `rechase-13386-13388-c681` (2026-10-12).

- [slang#13350 — glsl-module matrix `operator*`/`*=` gated off wgsl+metal (E36107)](13350-glsl-matrix-mul-wgsl-metal-gate.md) —
  triaged + reproduced; not a regression. draft PR #13356 open (7 gates); follow-ups #13355 (62 gated builtins) + #13359 (`filecheck=A,B` checks only A) filed. #13355 + #13359 are assigned to jkwak-work (HOLD unless jkwak asks the bot). #13356 CI gate: operator decision A defaulted 10-15 to (c), parked for jhelferty-nv (don't re-ask). Re-chase `rechase-13350-13355-r6-96e2` (2026-10-22, 7-day cadence).

- [slang#13041 — verify-documented-compiler-version.sh exit 4 (windows-aarch64); bot fix #13042 incomplete](13041-verify-compiler-version-exit4.md) —
  three post-fix hits (two in merge_group, 09-28/29, plus #11709 on 09-30). Diagnostic draft #13352 is waiting on the operator ready-flip and on jvepsalainen-nv choosing exit semantics; re-chase `rechase-13352-exit-seman-440c` (10-03).

- [slang PR #11709 — groupshared parameters by reference](11709-groupshared-param-by-reference.md) —
  owned by slang-fixer, CHANGES_REQUESTED. HELD until #13406 (the #13339 Ref split) lands; then one rebase-and-rework push with the unpushed P1 fix. jhelferty-nv answered every #13406 question 10-09 02:33Z; the original owner ran out of budget, so the work resumed in a fresh session on `…-11709/13406-resume`. **r5 pushed 10-09 08:49Z** (`4e2603652e`); **round 3 pushed 10-10 05:52Z (`7e683a211b`)**: her five answers, tangent-vector's no-rewrite `const __ref` direction (she deferred to him) and the round-2 review items. The GCC `-flarge-source-files` fix split out as **#13570**, which jhelferty-nv merged 10-13; **10-14/15: jhelferty-nv took #13406 over**: self-assigned, retitled "Split the Ref passing mode by access", 13 commits of her own (head `671215f5de`), with the `__ref_writeonly` read check deferred behind `-experimental-feature`. The bot stands down. #11709 rebases onto her final spellings when #13406 merges. Re-chase `rechase-13406-r7-c566` (10-17).
  - [#13406 review-round history](11709-13406-ref-split-review-rounds.md) — tangent-vector's round, the `readonly` rounds and reversal, the effective-mode settlement, round 3 + the GCC/FIDDLE split to #13570 and its 10-13 landing, the 10-09 budget/phantom-session/misrouted-webhook incident.

- [slang#13348 — inherited field through a property/subscript BoundStorage → E99997 ICE](13348-inherited-field-boundstorage-ice.md) —
  triaged + reproduced; three BoundMember consumers accept VarDecl only and reject InheritanceDecl. The author
  self-assigned it, so NO-GO and no fixer; silent at 10-07 and 10-14 re-chases; next `rechase-13348-assignee-5d97` (2026-10-21).

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
  HELD: external reporter co-assigned; re-chase 1 silent (10-06); re-chase 2 silent (10-13), operator asked; re-chase 3 silent (10-16), one reminder sent; recheck `rechase-13330-fourth-e68c` (10-20), defaults to hold if still silent.

- [slang-rhi#787 — CUDA↔Vulkan shared-texture missing sync](rhi-787-cuda-vulkan-shared-sync.md) —
  real missing `VK_QUEUE_FAMILY_EXTERNAL` ownership release, not a tolerance flake. PR #881 implements the maintainer-mandated
  `handOffShared`/`takeOverShared` API; non-draft (jhelferty flipped it 09-28), head `00fb748` (main merged 10-11) GPU-CI-green.
  Parked on jhelferty's R4/R5 answer (5907630393) + skallweitNV's review; operator reminder question unanswered 3× → default
  (3) wait. Re-chase `rhi-881-review-rechase-5a7c` (10-19).
  - [PR #881 review-round history (condensed)](rhi-787-review-history.md) — design convergence (#812 forks, the rejected
    `IExternalMemoryQueue` sketch), the review rounds, and the 09-24 → 10-11 ready/re-chase log.
- [slang#13565 — SemanticChecking compile-time step since 10-07](13565-semcheck-compile-perf-step.md) — OPEN, maintainer-owned (jvepsalainen-nv), silent; operator asked 10-16 re bot comment/bisect; green nightlies = baseline absorption, re-measure from absolute daily medians; 10-16 has a separate step-2
