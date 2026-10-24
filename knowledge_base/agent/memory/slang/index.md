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

- [slang PR #13473 — Metal resource-array KernelContext copies](13473-metal-resource-array-context-copy.md) —
  fork PR (tomaszbk). jkwak-work 10-23: start over, bot files a generic issue from the PR description. The bot filed #13894 (problem-only, verified). PARKED on the maintainer's discussion; re-check `rechase-slang-13894-r1` 10-27 13:00Z. Owner: slang-fixer `sess-1792777720128-uwee1o`.
- [slang#12630 — Texture1D.Load for CUDA/PTX](12630-texture1d-load-cuda.md) —
  DRAFT PR #13377 @2042d2c (Approach A), 0 CI runs. PARKED 10-23 with no timer, waiting on two jkwak-work decisions (CUDA CI run; OptiX raw 1D CUtexObject). 8 silent re-chases; 3 operator asks unanswered. "resume 12630" re-arms the 3-day re-check.
- [slang#13888 — spurious outer-scope candidates for ambiguous lookup](13888-ambiguous-lookup-spurious-candidates.md) —
  MEMBER-filed (skiminki-nv) 10-23 + bot ask for a PR. Fixed in draft PR #13889 (`pr: breaking change`, 7ac97a3; maintainer reviewing); PARKED on skiminki-nv accepting the breaking cases + un-drafting. Re-chase `rechase-slang-13888-r1` 10-27 13:00Z.
- [slang PR #11387 — autodiff readNone carry gate](11387-autodiff-readnone-carry-gate.md) —
  bot PR (fix/issue-11374); CHANGES_REQUESTED 09-15 addressed; waiting on jvepsalainen-nv (A)/(B) lookup + #12502 placement. 10-23 operator nudge ask withdrawn (over-gated); fixer merging master + one no-ping comment. Verify `rechase-11387-post-merge-0cda` 10-24 12:00Z.
- [slang#13877 — packed StructuredBuffer record loads stay scalar on CUDA/Vulkan](13877-packed-structuredbuffer-scalar-loads.md) —
  MEMBER-filed (tdavidovicNV) 10-22 19:59Z perf report; companion #13878 owned by a sibling Main. TRIAGED 20:23Z (cmt 6350491972, `reproduced`, P2); PARKED on maintainer design direction. Triager recheck t-22c2ef 10-29 15:00Z.
- [slang#13865 — `/format` fails: slangbot push + comment 403](13865-format-slash-command-slangbot-pat-403.md) —
  maintainer-filed + self-assigned (jkwak-work) 10-22; CI credential (slangbot email / `SLANGBOT_PAT`). slangbot account unrecoverable (owner left); assignee chose the org App-token + compare-link design 12:49Z; jkiviluoto-nv raised a workflow-execution security blocker on the upstream-branch push 12:51Z. HELD; resumes only on a bot mention or an operator GO.
- [slang#13752 — missing shadowing diagnostics](13752-shadowing-diagnostics.md) —
  skiminki-nv self-assigned. Part 1 (generic params) is built locally by slang-fixer; its PR is HELD on Q3 (members in scope?). Part 2 is parked on Q1–Q3. Re-check 10-26 12:00Z. ⚠️ Rename in slangpy `gridarg.slang` before Part 1 merges.
- [slang#13757 — slangd crashes on an array `settings` in didChangeConfiguration](13757-slangd-array-settings-crash.md) —
  bot-filed 10-20 by the #13179 fixer; maintainer-assigned to tangent-vector, milestone Q4 2026. Held; 1-line fix ready on an operator GO or `bot-ok`.
- [slang#13807 — `-wgpu -render-feature half` rows always ignored on NVIDIA](13807-wgpu-half-tests-ignored-dawn-shaderf16.md) —
  bot-filed 10-21 by the triager on jkwak-work's #13647 ask; assignee jkwak-work says "slang-rhi issue". Triage verdict given 10-22 (test infra / slang-rhi, low, P2). Held; resumes on a bot mention or an operator GO to file in slang-rhi.
- [slang#13841 — DebugDeclare on real storage](13841-debug-declare-real-storage.md) —
  DRAFT PR #13872 @5c5909334; R3 APPROVE_WITH_NITS; triage resolved 10-23 00:57Z. PARKED on pdeayton-nv review (BEHIND master). ⚠️ Stable id 910 / module v38 collide with draft #13564 (#13555); the second to merge renumbers.
- [slang#13875 — update mimalloc v2.1.7 → v2.5.2](13875-mimalloc-bump-2-5-2.md) —
  pdeayton-nv filed + self-labelled `bot-ok` 10-22 17:53Z (follow-on to #13827). Triaged 18:06Z (P2, approach B). PR #13879 @ce18ba9f9 READY, APPROVED (pdeayton-nv 10-23 17:31Z), CI green incl. Windows; merge BLOCKED on a maintainer. Re-chase r1 10-26 16:00Z.
- [slang#13828 — memory retained after unloading Slang DLLs with mimalloc](13828-mimalloc-dll-unload-memory.md) —
  DRAFT PR #13867 @2c13036b3 (MSVC/clang-cl `DllMain` hooks; MinGW excluded). Fix Report 10-22 16:01Z (partial), forwarded to the triager. PARKED on pdeayton-nv's MinGW answer + Windows CI 39807820023.
- [slang#13827 — duplicate operator new/delete with newer mimalloc on Windows](13827-mimalloc-windows-duplicate-operator-new.md) —
  pdeayton-nv (reporter + assignee). DRAFT PR #13850 @aedafd686 (`MI_OVERRIDE OFF` once), R1 APPROVE_WITH_NITS applied; triage resolved 10-22 01:26Z. **MERGED 10-22 17:41Z** (`80e4385a4`, merge queue); #13827 closed. Terminal.
- [slang#13840 — test coverage for modern-style syntax](13840-modern-syntax-test-coverage.md) —
  MEMBER-filed (jhelferty-nv) 10-21 21:40Z; maintainer-assigned to jvepsalainen-nv, Type=Testing. No reproducer. Routed to no coworker, nothing posted. Resumes only on a human comment.
- [slang#13767 — WGSL `[numthreads]` spec constant → `override` in `@workgroup_size`](13767-wgsl-numthreads-spec-const-override.md) —
  external (albertrodriguezclo) 10-20 feature; jkwak-work GO "let's go with A" 10-21. DRAFT PR #13826 (fixer `kclwp6`); R1 REQUEST_CHANGES (V1 const-of-override, same line as draft #13816) folded in; R2 APPROVE_WITH_NITS, nits applied @a707046; PARKED on jkwak-work review + falcor-ci approval, recheck 10-24 16:00Z. Operator: 3 filing GOs (GLSL `4u`, CUDA `_S1`, collect-global-uniforms).
- [slang#13824 — render-test binds a Texture2D.Handle input as a Vulkan storage image](13824-render-test-texture-handle-storage-image.md) —
  external (albertrodriguezclo) 10-21 18:31Z. A render-test access-inference bug, not emit. TRIAGED 18:51Z (cmt 6323929737, P2); Fix Report 21:14Z; PR #13829 READY (jkwak-work 10-22) @2a6ef6a after a dx12 test split (fixer `pz3euq`); CI run 39829158775 in flight; 2 unfiled side bugs await the operator. Operator asked once about filing the CUDA RWTexture2D side bug.
- [slang#13817 — type-flow: generics over a dynamic associated type, two conformances](13817-typeflow-dynamic-assoc-type-two-conformances.md) —
  external (LDAP) 10-21. Triaged (cmt 6314992118, P2, `reproduced`). DRAFT PR #13820 @c7517306b2 (fixer `n7r8qa`, `Refs`): the diamond E33180 is fixed and the witness segfault now reports E33180. PARKED on jkwak-work (cmt 6322223875: "known `dyn` limitation"); the triager posts the options. One-shot recheck 10-24 17:30Z.
- [slang#13789 — isParameterLocationUsed on a split mixed constant buffer](13789-isparameterlocationused-mixed-cb-split.md) —
  external (fuchstraumer) 10-20. Triaged (cmt 6298782357, P2). Cause in type legalization. DRAFT PR #13811 @8921fd5 (fixer session `4lrs0a`), Fix Report 10-21 16:17Z. PARKED on maintainer review (Metal emit change disclosed) + operator call on filing the pre-existing PB-in-CB binding bug. One-shot recheck 10-24 15:00Z.
- [slang#13795 — `-O0 -separate-debug-info` loads the spirv-opt wrapper](13795-separate-debug-info-o0-loads-spirv-opt.md) —
  CLOSED 10-22: bot PR #13801 merged by the assignee (e485e78). Open, outside the chain: operator call on filing the link+split+optimizer crash.
- [slang#13396 — self-referential struct pointer: "circularity during codegen"](13396-self-referential-struct-pointer-circularity.md) —
  bot-filed 10-02. DRAFT PR #13400 @b85731f2ce, owner fixer session `njpemm`, pinned send only. The HLSL/WGSL test legs are coupled to reporter PR #13652 (E55219). The nullptr side finding is already #13632. Ready flip waits on the operator.
- [slang#13126 — `ByteAddressBuffer.Load<S>()` passed to a call segfaults](13126-byteaddressbuffer-load-alignment-operand-drop.md) —
  external (Rexagon) 09-16; regression (#8547/#11595). `specializeFuncsForBufferLoadArgs` dropped the alignment operand. DRAFT PR #13130 @654c18a756 (merge of master 10-20), all external-repro variants + >128 B no-array shape covered 10-17. peer review final APPROVE. Fresh dispatch 39471864134 yielded and sits `waiting` on `falcor-ci` like 39063429240; re-dispatch is futile while `waiting` ∈ `ACTIVE_STATUSES` (93 waiting ci.yml runs repo-wide, retry logs "still active"). Blocked on `falcor-ci` approval + P2→P1, both pending with the operator. Re-check one-shot 10-26 18:00Z.
- [slangpy#1232 — Vulkan module `[[vk::push_constant]]` silent wrong results](slangpy-1232-vulkan-module-push-constant.md) —
  human-filed (albertrodriguezclo) 10-16; all coworker tiers closed. Split 10-20 into the SlangPy PR [slangpy#1235](slangpy-1235-push-constant-fail-loudly-pr.md) (APPROVED but **HELD by jkwak-work 10-22** until the slang/rhi fixes land; #1232 reassigned to kaizhangNV) and the upstream [slang#13713 → PR #13724](slang-13724-multiple-push-constant-blocks-e39033.md) (E39033 as an error, `pr: breaking change`, **MERGED 10-20 22:20Z** 69ad6c1; #13713 closed). Operator: rhi#810 promotion, #915 STAGE_ALL fix, GLSL export follow-up. Re-check 10-20 15:00Z.
- [slang#13733 — WGSL loop increment-in-body vs Tint robustness](13733-wgsl-loop-increment-tint-robustness.md) —
  human-filed (albertrodriguezclo) 10-17, a follow-on to #13066/PR #13071. Triaged (cmt 6235943785), P2, `reproduced`, Type=Feature. Option A (WGSL counted-`for`) was taken by the reporter in their own PR **#13740** (10-17, CI green, review requested from dshreiner-nv). Parked on maintainer review; Ask 2 (`[unroll]` warn) has no owner. One-shot recheck 10-24 15:00Z. Side note (restructure `nextSimpleRegionForSameBlock` never stored) unfiled, operator call.
- [slang-rhi#928 — Vulkan ReadBack on uncached host memory](slang-rhi-928-vulkan-readback-uncached.md) —
  human-filed (albertrodriguezclo) 10-20; reporter offered the PR. Triaged 10-20 (bot cmt 6291998659, data-only; reproduced on L40S). Fix = reporter PR #929 (CLA pending), owned by jvepsalainen-nv; #869 rebases after it. Re-check 10-27. Couples to our draft rhi#869 and rhi#722 (VMA).
- [slang#13770 — GCC stringop-overflow warning in unit-test-string.cpp](13770-unit-test-string-memcpy-warning.md) —
  human-filed (spate) 10-20 build warning (GCC≥14 `-Wstringop-overflow` false positive in `List<long>::reserve`). **MERGED** 10-22 19:05Z via PR #13782 (`ea4b88f`, `SLANG_ASSERT(m_count <= m_capacity)`); issue closed completed. Observe-only. Operator: 6 unfiled `List` follow-ups.
- [slang#13765 — WGSL vector builtins emitted as VECTOR_MAP_UNARY loops](13765-wgsl-vector-map-unary-loops.md) —
  human-filed 10-20, sibling of #13733/PR #13740; triaged 10-20 (cmt 6291764231, P2, Feature). Not moot after #13740 (counters 5→1). Rec A = `case wgsl:` arms. Reporter's PR #13781 (approach A) MERGED 10-22 22:31Z; issue CLOSED. 10-23 TERMINAL: triager verified on master, all 6 criteria pass, cross-target unroll no regression (only >4-row matrix diag E38206→E40020, optional follow-up). Side findings unfiled (operator).
- [slang#13519 — SeqCst VUID-10866](13519-seqcst-vuid-10866.md) —
  bot-triaged; PARKED 2026-10-23 via task-hygiene cap (3/3) on maintainer A/B (per-op downgrade vs SPIR-V diagnostic); jkwak-work assigned, silent; operator never answered the 10-20 ping-or-park ask. Wakes on webhook. Coupled to #13518.
- [slang#13518 — MemoryOrder validation](13518-memory-order-validation.md) —
  bot-triaged missing diagnostic. DRAFT PR #13541 @f961d32f0b (DIRTY 10-23, zero CI); internal review done (R2 APPROVE_WITH_NITS). HELD on maintainer Q1 (error/warning, which decides the breaking label) and Q2 (CAS Release/Acquire); operator ping decision pending, re-chase 10-26 then park. jkwak-work assigned. Coupled to #13519.
- [slang#13591 R-series — contributor standards for AI assistants](13591-authorship-rules-r-series.md) —
  szihs's umbrella + R1–R10 sub-issues (#13592–#13602), self-assigned, each with its own PR. Not dispatched.
- [slang#13631 — `workgroupUniformLoad` synchronizes only on WGSL](13631-workgroup-uniform-load-barrier.md) —
  human-filed (albertrodriguezclo) cross-target race: plain load off WGSL. Triaged 10-15 (cmt 6193295113), P2. DRAFT PR #13659 shipped @c136bcb after 2 REQUEST_CHANGES rounds (cap); unreviewed `specializeStageSwitch` change; gaps filed #13675 + #13683, both OWNED by this chain (dispatch nothing on their webhooks). PARKED on shepherd kaizhangNV accepting the semantics (also answers reporter cmt 6194249872). CI approval-gated. Re-check `rechase-13631-pr13659-se-8806` 10-20.
- [slang#13634 — WGSL BAB `Load<half>` → E56103](13634-wgsl-bab-load-half-int16.md) —
  human-filed (albertrodriguezclo) bug: byte-address `Load<half>` lowers via a u16 intermediate WGSL rejects (+ lowerBitCast 2nd producer). Triaged 10-15 P2; fixer stood down. CLOSED 10-21 21:37Z via reporter PR #13647 (merged); post-merge cleanup done 10-22 (triager fneziu). Gap 1 was a defensive nit (L40S 336/336 correct). Gaps 2/3 (struct `bit_cast` half, any-value half) are unfiled, waiting on the operator.
- [slang#13661 — WGSL BAB `Store<half>` rejected; atomic view?](13661-wgsl-bab-store-half-atomic-view.md) —
  human-filed (albertrodriguezclo) design question, the store follow-up to #13634/#13647. Triaged 10-15 17:15Z (cmt 6197941951), P2, reproduced. jkwak-work self-assigned 10-19 (Q4 milestone). Reporter owns all fix paths: #13735 (option c diagnostic), #13852 (aligned half2/4 stores, opened 10-22), and Metal filing. Bot: hands off. Re-check `i13661-recheck-6b22` reported 10-22 (verified): nothing for the bot. Waiting on jkwak-work to re-review #13735 and review #13852. The reporter files the Metal finding. #13647 re-check t-74f064 (10-23, verified): 6311604086 unanswered; a narrower issue is no longer needed because #13852 covers it.
- [slang#13654 — Metal `StructuredBuffer<S>` with a `Texture2D` field aborts slangc](13654-metal-structuredbuffer-texture-field-abort.md) —
  human-filed (albertrodriguezclo) Metal ICE: texture method on a structured-buffer element field drops its `this` operand → release assert `slang-intrinsic-expand.cpp:406`. Triaged 10-15 15:03Z (cmt 6195242328), P2: Metal wrongly exempt from E38204 + `legalizeResourceTypes` leaves SB<tuple> simple; fixer moved the decision into the legalizer (E38204 at `slang-legalize-types.cpp:1416`, validator unchanged) → DRAFT PR #13681 @87c393db2e, `pr: non-breaking`, jkwak-work assigned; triage resolved 10-16 07:48Z. PARKED on maintainer review + operator (ready/CI approval 38866727586; GPU A/B re-verified 10-16 (L40S, no fix-only failures); file-or-leave 2 unfiled: `uniform Material*` assert, validator struct-field location) — asked twice (10-16, 10-18 final), do not re-ask. 10-18 + 10-21 re-checks: unchanged (only event: milestoned Q4 2026 (Fall) 10-19). Re-check `rechase-13654-pr13681-e8c6` 10-24 08:00Z. #12529 ruled out.
  - [#13654 triage, fix rounds and GPU re-verification (history)](13654-history-triage-fix-gpu.md) — dispatch, [Triage] A+C, the legalizer-side re-plan + newly-rejected-shapes inventory, R1/R2, [Fix Report], [Triage Resolution], L40S A/B.
- [slang#13643 — WGSL address-space specialization re-clones its own clones](13643-wgsl-address-space-specialization-reclone.md) —
  human-filed (albertrodriguezclo) WGSL code-size bug: `specializeAddressSpace` keys its cache on the current callee, so per-call-site revisits re-clone (N identical copies). Triaged 10-15 P2 (shared pass, not WGSL-only). Fixed by reporter PR #13648 (triager-verified), **MERGED 10-21 05:20Z** (f96c0d829e, jkwak-work); issue closed by it. **TERMINAL** (re-check 10-22). #12563 must rebase onto it.
- [slang#13721 — `extension N::T` body can't see `N`'s members](13721-extension-namespace-qualified-target-lookup.md) —
  human-filed (skiminki-nv) language-semantics question. Triaged 10-16 19:26Z (cmt 6223072037), P2, reproduced; lookup is lexical-only. PARKED on a maintainer pick of A/A′/B/C (B conflicts with #11577); no fixer. Still silent at the 10-23 re-check; sibling #13750 got a tentative C++-semantics direction (a lead toward A, not a decision). Next re-check `t-aaff5f` 10-30.
- [slang#13688 — Metal inline RayQuery fixed tags (no curves / multi-level)](13688-metal-rayquery-curves-multilevel.md) —
  human-filed (albertrodriguezclo) Metal feature/design question (tags from type vs inferred; curve accessors). Triaged 10-16 08:03Z (cmt 6210949750) Feature/P3; #12691 doesn't cover inline queries. PARKED on kaizhangNV (assigned + Q4 milestone 10-19); reporter addendum 10-20 held, no bot post; re-check t-2c3ce2 10-23 found no change, now parked in supervisor-state. Sibling #13690.
- [slang#13737 — HLSL combined-sampler `Load`/`GetDimensions` extra sampler arg](13737-hlsl-combined-sampler-texture-only-ops.md) —
  human-filed (Buriola) 10-17, same root cause as #10522. Triaged (cmt 6236169441), P2, `reproduced`. DRAFT PR #13741 (R1 @45d7d9f used `$q` only), closes #13737 + #10522. R2 = **APPROVE_WITH_NITS** 10-18 06:59Z (trampoline forward on HLSL/CPU, Metal/WGSL keep `$q`), 0 bugs and 0 regressions; nits @ce23b34; Triage Resolution = Fixed. PARKED: CI 39107456646 on the `falcor-ci` gate; ready flip and 5 unfiled follow-ups are operator calls. #13737 closed by Buriola 10-18 (pre-merge); #10522 open. Re-check 10-24.
- [slang#13766 — WGSL pack_clamp_u8(int4) negative lane → 255](13766-wgsl-pack-clamp-u8-negative-lane.md) —
  **CLOSED** — external (albertrodriguezclo) 10-20; one-line WGSL intrinsic bug in hlsl.meta.slang. Reporter PR #13775 (option A + test, triager-verified) MERGED 10-22 03:03Z (jkwak-work approved); issue closed. Fixer `bp6g0t` stood down 10-20. Still open for the operator: whether to file the D3DCOLORtoUBYTE4 WGSL finding.
- [slang#13739 — WGSL/Metal BAB Load<T> keeps dead word loads](13739-wgsl-metal-bab-struct-load-dead-word-loads.md) —
  human-filed (albertrodriguezclo) codegen quality. Triaged 10-17 18:02Z P2 Bug (cmt 6238219006): `ByteAddressBufferLoad` missing from `mightHaveSideEffects` list, one-line fix A + 3 CHECK relaxes. Independent of #13732/#13734. jkwak-work assigned 10-19. Reporter PR #13764 @0ec0a72e9b (10-20) = option A + tests; triager verified it passes 10-20 13:11Z; waiting on maintainer CI approval + review; spin-wait side note unfiled (operator call); no fixer; re-check 10-23 15:00Z.
- [slang#13768 — WGSL tier1/tier2 storage-texture formats + E56106](13768-wgsl-storage-texture-tier1-tier2-formats.md) —
  human-filed (albertrodriguezclo) 10-20. Triaged 13:14Z (cmt 6291692744) P2, reproduced. Part 1 = DRAFT PR #13778 @9cfc373449 (`Part of`, fixer `kcxr4o`), R1 APPROVE_WITH_NITS, nits applied; the reporter said proceed. jkwak-work assigned 10-21. PARKED: operator ready-flip/CI (asked 10-20, re-asked 10-23 final, default hold) + part 2 E56106 B1–B4 on zangold-nv/expipiplus1 (17 tier1 RW pairs now silent). Re-check `t-79c65a` 10-30 13:00Z.
- [slang#13732 — WGSL member subscript copies whole uniform struct](13732-wgsl-uniform-member-subscript-whole-struct-copy.md) —
  human-filed (albertrodriguezclo) WGSL codegen perf; routed to slang-triager 10-17 ~15:00Z; regression since v2025.19 (#8668, triager); triaged 10-17 15:52Z P2 Bug (cmt 6236090926); reporter PR #13734 = option A, the reporter fixed the attribute ask at 28bf262e96, triager verified it 10-19 (cmt 6278114155); PARKED on maintainer review (kaizhangNV / dshreiner-nv requested); head ae4db91cd7 re-verified clean 10-21 (cmt 6278114155 edited); no fixer; re-check `rechase-13732-pr13734-ae-bd35` 10-23 15:00Z. Related #13703.
- [slang#13690 — Metal RayQuery → `intersector<>` lowering?](13690-metal-rayquery-intersector.md) —
  human-filed (albertrodriguezclo) Metal design question (candidate-free RayQuery → `intersector<>`; reuse one `intersection_query`). Triaged 10-16 07:46Z (cmt 6210678998), Feature/P3. PARKED on kaizhangNV (#11296 scope; explicit API vs recognition pass; reuse pass vs doc). No fixer. Re-check `t-b12d01` 10-23. Sibling #13688.
- [slang#13642 — slang-wasm `createSession` macros/search paths/options](13642-slang-wasm-createsession-options.md) —
  human-filed (albertrodriguezclo) feature request: wasm `createSession` takes only a target. Triaged 10-15 (cmt 6193362000), Feature/P2. Reporter then opened PR #13651 (shape A, `Fixes #13642`, fork-CI action_required), so the shape decision now sits in maintainer review. 10-21: jkwak-work (assigned) asked on the issue for a JS-vs-C++ API table + minimal C++-aligned change; triager answered 10-21 (cmt 6320607407). jkwak-work decided 10-21 20:36Z (cmt 6325983474): mirror C++ `SessionDesc` with `targets[]` of `TargetDesc`. Reporter updated #13651 to c0df7e87cf at 10-21 22:22Z; now in maintainer review. Re-check `rechase-13642-wasm-sessi-cbbe` 10-28.
- [slang#13662 — slang-wasm `loadModuleFromIRBlob` + `Module.serialize`](13662-slang-wasm-load-module-ir-blob.md) —
  human-filed (albertrodriguezclo) feature request: wasm offers only `loadModuleFromSource`. Triaged 10-15 17:14Z Feature/P3; dup of older #8744. Reporter PR #13663 is the fix (watch-only, fork-CI action_required); issue post held for operator GO; re-check t-ea7eeb 10-22.
- [slang#13673 — `sign` in `slang.numerics` (`ISignedNumeric.IntegerSign`)](13673-numerics-sign-requirement.md) —
  tangent-vector feature proposal, self-assigned. TRIAGED 10-16 (cmt 6210602589), P2; PARKED on tangent-vector, fixer HELD (design-RFC). Prereq: int-matrix conformances; CoopVec lacks core `sign`. Triager re-check t-6d276c 10-23.
- [slang#13676 — SPIR-V `float(sign(x))` redundant FToS→SToF round-trip](13676-spirv-sign-float-int-float-roundtrip.md) —
  human-filed (HildarTheDorf) missed optimization: SPIR-V `sign` on float is opaque `spirv_asm` FSign+ConvertFToS, so `float(sign(x))` round-trips. Triaged 10-15 20:17Z (cmt 6201414239), P3. Human-owned since tangent-vector self-assigned it on 10-21 (GoodFirstBug, Q4 milestone), so the GO-A decision is retired; the GLSL `sign`→int bug is still unfiled (operator decision open). Final triager re-check `t-aea473` 11-05.
- [slang#13664 — `getBuiltinModuleSource` null-deref without embedded source](13664-getbuiltinmodulesource-null-without-embedded-source.md) —
  human-filed (albertrodriguezclo) bug: null blobs dereferenced when `SLANG_EMBED_CORE_MODULE_SOURCE=OFF`. Triaged 10-15 17:26Z (cmt 6198150215), P3. The fix is reporter PR #13665 (CI green, but it leaves the compile path silently empty; follow-up B suggested). Parked on shepherd kaizhangNV; triager re-check `t-3606e0` 10-19.
- [slang#13635 cluster — WGSL NaN/Inf const-expressions Tint rejects](13635-wgsl-nonfinite-const-expr-cluster.md) —
  human-filed #13635: reporter PR #13645 was rejected by jkwak-work 10-21 ("hack"), and bot draft #13816 (IR bit_cast, stacked on #13669) resolved 10-21 15:44Z. Other drafts: #13657 → #13670 (string match, HOLD), #13658 → #13669, #13672 → #13680; all held for operator un-draft. Parked: #13671, #13682; doc-regen #13821.
- [slang#13639 — WGSL push constants as `var<immediate>`](13639-wgsl-push-constant-immediate.md) —
  human-filed (albertrodriguezclo). Triaged 10-15 (cmt 6193417129); fix owned by reporter's community PR #13646 (shepherd jkwak-work); slang-fixer held, no PR. #13646 MERGED 10-21, issue closed; only open item is the stale-line edit in cmt 6193417129 (operator, asked 10-22); re-check `rechase-13639-stale-comm-d4d7` 10-24. Follow-on design question #13666 (reporter, 10-15 17:05Z; arrays/matrices in `var<immediate>`) → slang-triager. Side segfault filed as #13656 (bot, unrouted; `__constref P` ← `ConstantBuffer<P>`, typeflow BorrowIn null cast).
- [slang#13640 — WGSL `diagnostic(...)` directive emission](13640-wgsl-diagnostic-directive.md) —
  human-filed (albertrodriguezclo) feature request: Tint rejects subgroup ops in divergent flow; asks for a way to emit
  `diagnostic(off, subgroup_uniformity)`. Triaged 10-15 (cmt 6193536016), P2, reproduced; recommends a compiler option (A).
  HANDED OFF: reporter PR #13660; jkwak-work to discuss at a meeting (10-21); re-check `recheck-13640-diag-surfa-f817` 10-27.
- [slang#13617 — WGSL fragment `SV_PrimitiveID`](13617-wgsl-fragment-primitive-id.md) —
  human-filed (rhendry) feature request: WGSL marks PrimitiveID unsupported (`isUnsupported` in `LegalizeWGSLEntryPointContext`); wgpu has `primitive_index`. Triaged 10-14 (cmt 6161247791), P2; GO on Approach A → DRAFT PR #13619 @b5340af7ab, triage resolved 10-14 10:18Z (internal R2 APPROVE_WITH_NITS); CI dispatch expired (full matrix runs at ready); parked on maintainer + operator ready; re-chased 10-15 (no human activity; jkwak-work milestoned #13617 Q4 2026; operator asks re-asked once); re-chased 10-17/10-19/10-21/10-23 (unchanged; decisions listed pending, not re-asked), next re-chase 10-25 10:30Z (`rechase-13617-primitive-6dc8`); jkwak-work assigned. Side ICE (WGSL nested-struct `int` SV field, E99999) filed as #13620; global-`in` SV stage-check gap filed as #13622 (both bot, unrouted; their issue_opened webhooks are self-echoes). SV_WaveLaneIndex no-`enable subgroups` side note unfiled, operator call.
- [slang#13590 — WGSL emits `bool` members in `var<uniform>` structs](13590-wgsl-bool-uniform-host-shareable.md) —
  human-filed (j8asic) WGSL bug: bool in host-shareable address spaces isn't lowered to int (SPIR-V-only `lowerLeafLogicalType` case). slangpy#787 (same author) works around it with `uniform uint`. Triaged 10-13 (cmt 6144341398), P2, 3 gaps; fixer released for draft PR. Triage resolved 10-13 20:49Z; HELD on kaizhangNV review + CI. 2 follow-ups unfiled (push-constant no-@binding; bool2 varyings), operator call. DRAFT PR #13607 @7851898586 (10-13, internal review R1 APPROVE_WITH_NITS applied), PR assignee kaizhangNV; issue reassigned to jkwak-work + milestone Q4 2026 (10-14). CI not run (draft). Unchanged re-chases: 10-14, 10-15, 10-16 → **PARKED** 10-16 in the task-hygiene parked-chain register (no re-chase armed); held on kaizhangNV/jkwak-work review + CI approval gate 38462553148.
- [slang#13571 — WGSL matrix negation emitted as `matNxM<f32>(0) - m`](13571-wgsl-matrix-negation.md) —
  human-filed (andy-slater) WGSL emit bug (`kIROp_Neg` matrix `T(0)-x`). Triaged 10-11 (cmt 6113276208), P2; triage resolved 10-12; draft PR #13572 @46ac7f64a7 awaiting jkwak-work (0 reviews); gated CI run deleted (404), so CI has to be re-triggered at ready. PARKED 10-20 after 3 unchanged re-chases (parked-chain register, no re-arm). 4 follow-ups unfiled, PARKED-UNANSWERED (do not re-ask).
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
  **CLOSED 2026-10-09** by saipraveenb25 (fixed by #13234). slangpy#1167: CUDA check passed 10-16; regression-test PR slangpy#1225 (draft) awaits its round-2 reviewer verdict, re-check `recheck-slangpy-1225-r2-d743` (10-20 14:00Z). #13301: on 10-18 at 02:45Z saipraveenb25 said to open the header-guard PR, and said it closes #13301 and slangpy#1204; the conditional `__func_extension` case is deferred. Draft PR **#13742** (`e2d4abb15`, slang-fixer `sess-1789716207340-dwbdoz`) opened 10-18 03:29Z, review APPROVE_WITH_NITS; its bot-dispatched CI is stuck `waiting` (priority-yield + falcor gate). 3 operator decisions open (follow-up issue, slangpy#1204 mention, un-draft); 10-19: slangpy-fixer independently verified #13742 fixes slangpy#1204 on unmodified slangpy main (vk+cuda L40S: interface load/store 0→3; #1206 test 0/20→20/20), matching slang-reviewer; #1206 decision re-framed to operator as A merge-interim / B hold-then-test-only / C close; 10-20 re-chase: no movement, still unanswered (tracked by `rechase-slangpy-1204-pr1-3f4d`, 10-23 10:30Z). 10-21: saipraveenb25 marked #13742 **ready for review** at 07:29Z (requested team `dev`), which ran CI 39562318710: 60 pass, test-falcor still running at 09:25Z; no human review yet. Un-draft decision moot; follow-up-issue + slangpy#1204-mention decisions still open. **10-22 04:02:51Z: #13742 MERGED** by saipraveenb25 (merge commit `653bfdeef`). #13301 closed as completed. The fixer removed its worktree and sentinel. Cancelled `rechase-slang-13301-pr13-19d8`. slangpy#1204/#1206 are still open. The `rechase-slangpy-1204-pr1-3f4d` prompt now says the gate is the next Slang release after v2026.20 plus the slangpy pin bump. The follow-up-issue decision (3 spellings + 4 segfaults) is still open; nothing tracks them now. The slangpy#1204-mention decision is moot. 10-23 re-chase: no movement. There is no Slang release after v2026.20, the slangpy pin is still 2026.20 (`e7bb22421`), there are no new human comments, and the operator has not answered A/B/C. Next re-check: `rechase-slangpy-1204-pr1-1e0b` (10-26 10:30Z).

- [slang#13555 — `-ignore-capabilities` + case-less `__target_switch` → silent UB](13555-ignore-capabilities-caseless-target-switch.md) —
  external bug P2, long-standing. Draft PR #13564 (head eac83d94ed). [Triage Resolution] 10-15. PARKED on maintainers (breaking? cpp `Buffer<T>.Load` case) + operator (ready/merge). 10-22: #13406 merged (master min=max=37, ids to 909), so #13564 is CONFLICTING. Asked the triager to merge origin/master and move to 910/max 38. Re-chase `rechase-13564-merge-veri-837b` (10-29).

- [slang#13556 — CUDA/PTX `SampleGrad` via `tex*Grad`](13556-cuda-samplegrad.md) —
  **MERGED 2026-10-15** (#13559, combined-sampler only; separate-sampler stays E36107 per jkwak-work). Possible unfiled follow-up: separate-sampler `Sample`/`SampleLevel` on CUDA.
- [slang#13544 — C++14 `'` digit separators](13544-digit-separators.md) —
  **CLOSED 10-13 by the reporter (completed).** tangent-vector refused `'` ("`_` … is already supported"), and skiminki-nv and the reporter agreed. Still live: draft #13547 (float `_`, `Part of #13544`), blocked until skiminki-nv lifts it, though they suggested this exact scope; and draft #13546 (`#if` decoding, `Fixes #13545`). CI on both waits on falcor-ci. Final re-chase `rechase-13544-tv-6b49` ran 10-16 16:00Z: nothing had changed, and the operator never answered. **PARKED on an inbound; no further re-chase.**
  - [#13544 triage, drafts, maintainer rounds and close (history)](13544-history-triage-to-close.md) — disposition, #13545/#13546/#13547, skiminki-nv deferral + block, tangent-vector's refusal, reporter close, final re-chase.

- [slangpy#1214: SlangPy Tests red on every Slang PR since slangpy#1199](slangpy-1214-cuda-cap-ci-latest-slang.md) —
  **an outage of a required check that blocks all Slang merges.** The one-line fix is in slangpy `ci-latest-slang.yml` and belongs to the maintainers. Escalated to the operator 10-08.

- [slang#13536 — add `RTexture*`, warn on `readonly`/`writeonly` on `RWTexture*`](13536-rtexture-deprecate-readonly-rwtexture.md) —
  maintainer-authored and self-assigned feature (step 1 of 2). Triaged and reproduced, P2. The fixer is HELD until the author makes the HLSL choice (reject vs lower with loss); still silent at the 10-11 and 10-18 re-chases; next re-chase `rechase-13536-hlsl-choic-2675` (2026-10-25).

- [nanoclaw PR: expired falcor gate → `gate_expired`](ci-babysitter-gate-expired-pr.md) — **PARKED 10-19, no PR.** The babysitter's two sweep-gate fixes are durable patches in `data/patches/`, never pushed; the operator never answered (asked 10-16, 10-17). Resume only on an operator "open it".
- [Yield-retry bot starved by `waiting` runs](ci-retry-yielded-bot-starved-by-waiting-runs.md) — `retry-yielded-bot-ci.py` counts approval-parked `waiting` runs as active, so it never retries yielded bot CI. Maintainer decision; raised with the operator 10-12, still live 10-21 (#13201 gate expiry).
- [Actions queue stall 10-17](actions-queue-stall-2026-10-17.md) — **resolved**: a 2h14m stall (07:56Z→~10:10Z) on shader-slang/slang only, which hit GitHub-hosted jobs too. It cleared before any action we know of, and the cause is unknown.
- [Actions run history gap 10-01→10-07](actions-run-history-gap-2026-10-01-07.md) — oldest-first deletion of workflow runs and their check-runs, 10-01 20:05Z to 10-09 ~16Z. It moved about 1h of history per hour, paused from ~10-14 16Z for about 2 days, then **resumed by 10-16 22Z** (front about 10-10 00Z). Cause unknown; operator asked 10-12, 10-13 and 10-16. PRs with heads in the window look like `no-ci`.

- [slang#13515 — LLVM prebuilt key change after #13139 (cold builds, 120-min cancels)](13515-windows-aarch64-llvm-prebuilt.md) —
  **TERMINAL 2026-10-12.** #13526 merged at 09:07Z (`f7e14a1a62`) and #13515 auto-closed. Master's key is now `b3ad5163`, with prebuilts live. 8 human fork PRs still need a master merge from their authors. Lessons: a comment edit moves the key, and a seed counts only once a consumer has linked against it.

- [slang#9078 — GLSL→Metal global varying layout-key crash](9078-glsl-metal-global-layout-key.md) —
  **draft PR #13467** (`302264acd3`) implements jhelferty-nv's producer-side design. `[Fix Report]` Partial. Reviewer REQUEST_CHANGES (1/2):
  on CPU/CUDA every global after a user in/out is mis-offset (wrong data, where master asserted). Held on jhelferty-nv's a/b/c; the reviewer recommends (a). No reply at the 10-09 or 10-12 re-chases. The operator was asked 10-12 about pinging jvepsalainen-nv; next re-chase is `rechase-9078-jhelferty-602a` (2026-10-15).

- [slang#13220 — CUDA interface dispatch unreachable default, draft PR #13228](13220-cuda-dispatch-unreachable-default.md) —
  held draft `842ea5d5c1`, no CI signal yet (Falcor gate expired). Waiting on kaizhangNV's undefined/trap/return answer (silent since 10-05) and the operator's a/b/c.
  Webhook-driven, plus passive one-shot `passive-13228-d25-43d6` (2026-10-30).

- [slang#13259 + #12934 — typeflow refined-info re-wrap ICE, PR #12935](13259-typeflow-refined-info-rewrap.md) —
  **MERGED 2026-10-05** (`e6be8dcdd7`). The producer fix in `makeInfoForConcreteType` replaced a disproven consumer `none()` fix. Holds the overclaim timeline and lessons.

- [slang#13436 — DownstreamArgs lost across option levels (linkWithOptions / addTarget)](13436-downstream-args-cross-level.md) —
  **CLOSED 10-12**: PR #13450 merged by kaizhangNV (e4d92bf0bb), issue auto-closed. Side finding held, unfiled (explicit operator A only).

- [slang#12627 — CUDA masked RWTexture store, draft PR #13363](12627-cuda-masked-rwtexture-store.md) —
  held on jkwak-work's coherency answer (RMW+warning vs CUDA error; warning scope). Codes E56020–E56022. On 10-21 I lifted the operator hold
  as over-gating (a merge onto our own branch plus a verified comment aren't gated). The fixer is doing a plain master merge (`cebafb34a5` locally),
  running the L40S tests and pushing, then posts one #12627 re-ask. Next re-chase `rechase-12627-post-merge-a776` (2026-10-24 08:00Z). Follow-ups #13361/#13362/#13364/#13365 not dispatched.

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
  design-gated feature, triage NO-GO; **PARKED** on maintainers (coverage model + redundant-nested-`try` policy), waiting on Yong. spec#63 (merged 10-14) is the current narrow rule, not a decision. #13514 (merged 10-16) made `try g(f())` an error, so only the design question remains. Re-chase `rechase-13491-try-covera-b893` (10-28).
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
  jkwak-work since 10-14. Option A (1-line BlockMerge) go/no-go: final ask sent 10-08 (row 478682), ask budget exhausted →
  HOLD (no reply through 10-22). B/C/D need maintainer design; upstream SPIRV-Tools#6930 (abs folding) **merged 10-14**,
  not yet in Slang's submodule. 10-22 passive check done; no timer left — webhook-driven only.

- [slang#13704 — WGSL forced scalar layout on entry-point uniforms](13704-wgsl-forced-scalar-entry-point-uniforms.md) —
  triaged 10-16; reporter PR #13706 open (10-19); must use `isWGPUTarget` (couples to #13402).
- [slang#13391 + #8323 — WGSL-via-Tint std140 layout, draft PR #13402](13391-wgsl-tint-std140.md) —
  our gates have passed (review r2 APPROVE_WITH_NITS). Its CI run was deleted (404 as of 10-08), and only un-drafting (B) gets around the bot-dispatch throttle. Waiting on the operator's B/C decision; re-chased weekly since 10-12 (8 asks unanswered).

- [slang#13298 — GCP-T4 runner dies mid-test in release-gpu-dx (pagefile)](13298-gcp-t4-runner-loss-pagefile.md) —
  CLOSED 10-22 by maintainer; 32 GiB pagefile fix held (0 recurrences post-rollout). Terminal record.
- [slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout](13423-metal-cb-scalar-layout.md) —
  enhancement P2, not a regression (#11578 kept CBs native on purpose). GO on Approach A via the triager → **draft PR #13425**
  (review r2 APPROVE_WITH_NITS), parked on a maintainer review / un-draft; #13386 lands first. Master has taken its stable id +
  module version three times (10-09, 10-15, 10-21); the 10-21 merge to 910 / max 37 is dispatched. Dated readings:
  [re-chase log](13423-metal-cb-scalar-layout-rechase-log.md).

- [slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum](13419-extern-enum-conditional-binding.md) —
  triaged + reproduced, P2, not a regression; link-time folding misses checked initializers. NO-GO (the reporter is the assignee). **Assignee PR #13487** (Approach A, opened 10-07) is open. Its head `53035c247` has CI with 1 Falcor failure, and tangent-vector posted 5 critical inline comments on 10-16 that are still unanswered; the fixer briefing is superseded. Re-chase `rechase-13419-pr13487-5716` (2026-10-28).

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
  triaged + reproduced; not a regression. draft PR #13356 open (7 gates); follow-ups #13355 (62 gated builtins) + #13359 (`filecheck=A,B` checks only A) filed. #13355 + #13359 are assigned to jkwak-work (HOLD unless jkwak asks the bot). #13356 CI gate: operator decision A defaulted 10-15 to (c), parked for jhelferty-nv (don't re-ask). PR #13356 gate run expires ~10-30 21:34Z (status comment, no rerun). r6 10-22: no change. Re-chase `rechase-13350-13355-r7-9ae4` (2026-10-31).

- [slang#13041 — verify-documented-compiler-version.sh exit 4 (windows-aarch64); bot fix #13042 incomplete](13041-verify-compiler-version-exit4.md) —
  three post-fix hits (two in merge_group, 09-28/29, plus #11709 on 09-30). Diagnostic draft #13352 is waiting on the operator ready-flip and on jvepsalainen-nv choosing exit semantics; re-chase `rechase-13352-exit-seman-440c` (10-03).

- [slang PR #11709 — groupshared parameters by reference](11709-groupshared-param-by-reference.md) —
  owned by slang-fixer, CHANGES_REQUESTED. HELD until #13406 (the #13339 Ref split) lands; then one rebase-and-rework push with the unpushed P1 fix. jhelferty-nv answered every #13406 question 10-09 02:33Z; the original owner ran out of budget, so the work resumed in a fresh session on `…-11709/13406-resume`. **r5 pushed 10-09 08:49Z** (`4e2603652e`); **round 3 pushed 10-10 05:52Z (`7e683a211b`)**: her five answers, tangent-vector's no-rewrite `const __ref` direction (she deferred to him) and the round-2 review items. The GCC `-flarge-source-files` fix split out as **#13570**, which jhelferty-nv merged 10-13; **10-14/15: jhelferty-nv took #13406 over**: self-assigned, retitled "Split the Ref passing mode by access", 13 commits of her own (head `671215f5de`), with the `__ref_writeonly` read check deferred behind `-experimental-feature`. The bot stands down. #11709 rebases onto her final spellings when #13406 merges. **#13406 MERGED 10-22 08:47Z (`0bd71cd709`, jhelferty-nv), so the #11709 hold has lifted.** The next step waits on the operator: is the bot allowed to rebase #11709, or does her stand-down cover it?
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
  HELD: external reporter co-assigned; re-chase 1 silent (10-06); re-chase 2 silent (10-13), operator asked; re-chase 3 silent (10-16), one reminder sent; re-chase 4 silent (10-20), default hold applied (#13078 merged 10-19); recheck `rechase-13330-fifth-e954` (11-03), parks indefinitely if still silent.

- [slang-rhi#787 — CUDA↔Vulkan shared-texture missing sync](rhi-787-cuda-vulkan-shared-sync.md) —
  real missing `VK_QUEUE_FAMILY_EXTERNAL` ownership release, not a tolerance flake. PR #881 implements the maintainer-mandated
  `handOffShared`/`takeOverShared` API; non-draft (jhelferty flipped it 09-28), head `00fb748` (main merged 10-11) GPU-CI-green.
  Parked on jhelferty's R4/R5 answer (5907630393) + skallweitNV's review; operator reminder question unanswered 3× → default
  (3) wait. Unchanged on 10-19; re-chase `rhi-881-review-rechase-7e72` (10-23).
  - [PR #881 review-round history (condensed)](rhi-787-review-history.md) — design convergence (#812 forks, the rejected
    `IExternalMemoryQueue` sketch), the review rounds, and the 09-24 → 10-11 ready/re-chase log.
- [slang#13549 — bump pinned LLVM to drop the ARM COFF patch](13549-llvm-pin-coff-patch.md) — OPEN, blocked upstream on llvm/llvm-project#229712; maintainer-owned (jkwak-work); one-shot re-chase `rechase-slang-13549-r1-a169` 11-06 09:00Z
- [slang#13565 — SemanticChecking compile-time step since 10-07](13565-semcheck-compile-perf-step.md) — OPEN, maintainer-owned (jvepsalainen-nv), silent; operator asked 10-16 re bot comment/bisect; green nightlies = baseline absorption, re-measure from absolute daily medians; 10-16 had a separate step-2, resolved 10-17 by the #13537 revert (#13712); re-chase `rechase-13565-r5-a966` 10-19 09:00Z

- [slang#13793 — member typealias caps don't reach enclosing struct](13793-member-typealias-capability-propagation.md) —
  terminal: the triaged fix was abandoned because kaizhangNV's own PR #13798 supersedes it. Four new-error shapes were
  posted on the issue. 10-21 17:32Z: jhelferty sent the design question to tangent-vector and skiminki-nv (no bot mention), held. Lesson: check the timeline for a reporter PR before dispatching a fixer.
