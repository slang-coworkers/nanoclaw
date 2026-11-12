---
type: index
title: Slang / slang-rhi chain records
description: Per-chain records for shader-slang issue and PR work driven through this orchestrator
---

# Slang chains

[Raw source memos](raw/index.md) — verbatim coworker memos cited by chain records.

Per-chain state for shader-slang work. One file per issue/PR chain; open the file before
acting on a chain — these hold verified receipts (shas, job ids, log line numbers) that
decay and must be re-read, not remembered.

## Map
- [slang#14453 — CUDA: `DescriptorHandle` from `uint2` in a `static const` initializer skips E36107 and emits invalid code](14453-cuda-descriptorhandle-static-const-init-undiagnosed.md) — maintainer (jkwak-work) 11-11 07:59Z, assigned to the author by jhelferty-nv; follow-up of merged PR #14204 (#13107). HELD rung 4: no dispatch, no post.
- [slang#14451 — [SPIR-V] integer mad() emits GLSL.std.450 Fma](14451-spirv-integer-mad-emits-glsl-fma.md) — human (Guo-Haowei) 11-11 06:09Z. TRIAGED bug/P2, reproduced (SPIR-V, GLSL, CUDA, CPU). **Draft PR #14452** (fb3d9dc745) R1 APPROVE_WITH_NITS applied, RESTING on maintainer review (jhelferty-nv); ready-flip pending (11-16 weekly list). Side issue #14454 is filed-only (no dispatch).
- [slang#14448 — AbortCompilationException escapes SLANG_NO_THROW getLayout / findAndCheckEntryPoint on E39997](14448-abort-exception-escapes-getlayout-findandcheckentrypoint.md) — human (g-whiz) 11-10 22:57Z. TRIAGED 23:14Z bug/P2, reproduced on master; 3 leaking methods. **Draft PR #14450** (9399064c0) r1 APPROVE_WITH_NITS applied, RESTING on maintainer review (kaizhangNV); on the weekly ready-flip list. Sibling of #12387/PR #12552.
- [slang#14447 — NVRTC compile fails when CUDA_PATH is set but CUDA bin\x64 is not on PATH (nvrtc-builtins DLL load)](14447-nvrtc-builtins-dll-not-on-path.md) — maintainer (jkwak-work) 11-10 19:46Z, assigned to the author by jhelferty-nv; found via PR #14419. HELD rung 4: no dispatch, no post. Author fix PR #14449 (11-10 23:13Z), not forwarded (approver paused).
- [slang#14445 — buffer-element field reads fold through an index var that SSA coalescing reuses (WGSL/HLSL/GLSL)](14445-wgsl-buffer-field-read-index-reuse.md) — human (garyo) 11-10. Dup of #13273 (fixed by PR #13283, v2026.21); reporter confirmed fixed. **TERMINAL on our side**, a maintainer closes; no fixer.
- [slang#14444 — concurrent DXIL getEntryPointCode() + DXC #include races shared SourceManager/CacheFileSystem](14444-concurrent-dxil-include-sourcemanager-race.md) — bot-filed 11-10 16:58Z (H1 of #14441). Owned by the #14441 chain; issue_opened needs NO dispatch. FILED-ONLY, fixer held on the #14441 scope pick.
- [slang#14443 — concurrent first getEntryPointCode() on LLVM targets crashes/hangs (getOrLoadSlangLLVM + llvm::cl races)](14443-concurrent-llvm-first-codegen-race.md) — bot-filed 11-10 16:58Z (H2 of #14441). Owned by the #14441 chain; issue_opened needs NO dispatch. Fixer via the #14441 triager; **draft PR #14446** review-complete (APPROVE_WITH_NITS applied), RESTING on maintainer review; on the 11-16 ready-flip list.
- [slang#14441 — async target codegen while the session owner keeps working (prepared-compilation job API)](14441-async-target-codegen-prepared-job.md) — maintainer (skallweitNV) 11-10 16:04Z, no labels/assignees. TRIAGED 16:19Z feature/P2 (cmt 6772694452). PARKED on maintainer scope A/B/C (rec C then A); triager re-check t-529d77 11-17. No fixer. H1/H2 races reproduced and filed as #14443/#14444 (no dispatch for their issue_opened; no fixer).
- [slang#14437 — macOS CI `upload-artifact` fails with `CreateArtifact … ENOTFOUND` (3 PRs in 5 days)](14437-ci-macos-upload-artifact-enotfound.md) — bot-filed 11-10 10:05Z by slang-ci-babysitter (operator ≥3-PRs/14d rule). Facts-only infra report; babysitter-owned, issue_opened needs NO dispatch, no post.
- [slang#14433 — CUDA coop matrix: invalid element type/shape → ICE (exit -2) via `SLANG_RELEASE_ASSERT(false)` in `emitWMMAFragmentType`](14433-cuda-coop-mat-invalid-type-ice.md) — maintainer (jkwak-work) 11-10 02:44Z, self-assigned 1 s later; #14266 follow-up. HELD rung 4: no dispatch, no post.
- [slang#14429 — reflection API: query generic parameters + constraints (DeclRef-aware; SlangPy `dyn` → generics migration)](14429-reflection-generic-params-constraints.md) — maintainer (tangent-vector) 11-09 23:47Z, assigned to the author by jhelferty-nv; batch with #14428. HELD rung 4: no dispatch, no post.
- [slang#14426 — module-scope `layout(derivative_group_linearNV) in;` ignored for a generic compute entry point](14426-generic-entry-module-scope-derivative-group.md) — bot-filed 11-09 by the #12392 triager (side find S1 of #12721 review r2). Owned by the #12392 chain, FILED-ONLY; its issue_opened needs NO dispatch. No fixer (shares the #12721/#12777/#13882 path).
- [slang#14424 — CUDA runtime regression after #13781 ([ForceUnroll(4)] on VECTOR_MAP/MATRIX_MAP)](14424-cuda-perf-regression-forceunroll-13781.md) — maintainer (jkwak-work) 11-09 18:27Z, assigned to the author by jhelferty-nv. Own plan: a temp PR drops the unroll, then the nightly decides. HELD rung 4: no dispatch, no post. Our 10-23 #13765 verification of #13781 was correctness-only.
- [slang#14415 — NVIDIA Vulkan (RTX 5080): dynamically indexed float3 accumulator with `continue` nondeterministic](14415-nvidia-vulkan-dynamic-index-float3-accumulator-continue.md) — TRIAGED P2, no Slang defect (likely Blackwell driver); `Vendor Driver Bug`. HELD rung 4 (jhelferty-nv assigned, awaiting reporter on driver 621.14); no bot posts.
- [slang#14401 — `>>` rejected on a generic `T : ILogical`/`IInteger` operand](14401-generic-ilogical-bit-shift.md) — human (JasperKr) 11-08 00:23Z, no labels/assignees. TRIAGED 00:33Z bug/P2 (cmt 6715095387): no generic ILogical/IInteger shift operators in core.meta.slang. **Draft PR #14402** (fixer iyvxbu) R2 APPROVE. PARKED: falcor-ci gate on run 42441928885 + maintainer Q on bool-left user shift overloads; ready-flip on weekly list.
- [slang#14394 — Metal: ParameterBlock emits an argument buffer, not flat texture/sampler bindings](14394-metal-parameterblock-argument-buffer.md) — human (rope-hmg) 11-07 01:19Z. TRIAGED 01:30Z question/working-as-designed P3 (cmt 6700349707); workaround posted. **CLOSED 21:54Z by the reporter** (workaround confirmed) — terminal; no fixer.
- [slang#14390 — WGSL: barrier in a loop bounded by a groupshared value fails Tint uniformity](14390-wgsl-barrier-loop-groupshared-uniformity.md) — human (albertrodriguezclo) 11-06, bug/P2. Fix is the reporter's PR **#14391** (shepherd skiminki-nv); bot fix HELD, nothing posted on #14391. RESTING on review; on merge, decide docs and branch cleanup.
- [slang#14364 — deprecate/remove legacy specialization path (global `type_param`, existential-slot pending layout; compiler + slang-rhi)](14364-deprecate-legacy-specialization-path.md) — maintainer (tangent-vector) 11-05 22:29Z, self-assigned 11 s later. Design/coordination item, no ask of the bot. HELD, rung 4: no dispatch, no post.
- [slang#14359 — binary-module reload resolves a relative dependency under the wrong include root](14359-binary-module-dependency-wrong-include-root.md) — human (ccummingsNV) 11-05. TRIAGED P2; draft PR #14362. **PARKED on maintainer Q1**; re-check `recheck-14359-q1-eeb1` 11-12 23:30Z. Follow-ups #14370/#14371 filed-only.
- [slang#14357 — generic struct with all-default params: `Foo foo;` OK but bare `Foo(42u)` E39999](14357-generic-default-bare-constructor-call.md) — human (tdavidovicNV, MEMBER) 11-05 18:16Z. TRIAGED 18:29Z enhancement/P3 (cmt 6665924893): `inferGenericArguments` else-branch returns before the default solver. PARKED on csyonghe Q1-Q3 (A defaults / B ctor inference / C reject); no fixer. Triager re-check t-8ebc58 11-12 18:00Z.
- [slang#14350 — canonical IR set order depends on the C++ compiler that built slangc](14350-canonical-ir-set-order-getuniqueid.md) —
  maintainer (jhelferty-nv) filed + self-assigned 11-05. Held under rung 4 until 11-11 19:16Z, when she asked the bot to triage (cmt 6805017670). TRIAGED 19:57Z bug/low/P2 (cmt 6805886505); duplicate of bot-filed #13474 (jvepsalainen-nv). Fix A verified, no test impact. PARKED on her; no fixer.
- [slang#14348 — CoopMat rejects spec-constant Rows/Cols (E39999, SPIR-V)](14348-coopmat-spec-constant-dims.md) — feature-request/P2, deliberate (#7855). PARKED on jkwak-work (A/C/other); no fixer; triager re-check 11-12 14:00Z.
- [slang#14423 — reflection of concrete variadic generic type-pack elements](14423-reflect-variadic-type-pack-elements.md) —
  maintainer feature request (kaizhangNV) 11-09, assigned to the author by jhelferty-nv; HELD under rung 4 (no dispatch, no post).
- [slang#14420 — dead-store removal drops a store that a NoSideEffect callee reads](14420-dse-drops-store-read-by-nosideeffect-callee.md) —
  maintainer-filed 11-09, self-assigned; HELD under rung 4 (no dispatch, no post). Follow-up to #14346.
- [slang#14345 — Metal emits a groupshared load after the barrier that follows it](14345-metal-groupshared-load-after-barrier.md) —
  human 11-05; TRIAGED bug/high/P2, same root cause as #13409, so FOLDED into that chain (draft #13421 adds `Fixes #14345`; weekly ready-flip list). Reporter fork PR #14346 competes; operator decides.
- [slang#14333 — modifier order changes SV_Barycentrics interpolation (SPIR-V + GLSL)](14333-sv-barycentrics-modifier-order.md) —
  human (pdeayton-nv) 11-05, self-assigned. TRIAGED P2; **MERGED 11-06 18:42Z** (PR #14365 → df8b1d354), issue closed. Side finds #14367/#14368/#14369/#14373 + #14374 (nested modifiers, DXC rule, per pdeayton-nv) belong to this chain (issue_opened needs NO dispatch; filed-only).
- [slang#10232 — `double` on WGSL/Metal gives ICE E99997 instead of a diagnostic](10232-double-wgsl-metal-ice.md) —
  human (rkoivunen-sw; assignee jkwak-work). TRIAGED P2 11-04; **draft PR #14332** (`pr: breaking change`, fixer vr0qdh), ready-flip pending. PARKED on jkwak-work: the 3 remaining E99997 paths here or separately.
- [slang#13972 — reflection says GLSL `readonly buffer` is mutable; WGSL now emits `read`](13972-glsl-readonly-buffer-reflection-wgsl-read.md) —
  bot-filed 10-28 (jkwak-work asked). PARKED on assignee pick A/B/C/D; GPU-confirmed regression in v2026.21 (v2026.20 OK); jkwak-work pinged 11-04 (cmt 6635682718); re-check t-72709c 11-11, no 2nd ping.
- [slang#14307 — WGSL crash: scalar uniform array element as call arg](14307-wgsl-scalar-uniform-array-call-arg-crash.md) — human 11-04. Reporter PR #14308 and our #13381 (same peephole hunk as #13380) both fix it. 11-06 jkwak-work approved #13381 and flipped it ready; parked on jkwak-work, no bot action.

- slang#14306 (`Ptr - unsigned` offset moves the pointer forward; u8/u16 on all targets) — bot-filed 11-04 15:27Z by slang-triager, side-find D of the [#14305 chain](14305-vulkan-negative-physical-ptr-arithmetic.md). issue_opened needs NO dispatch; FILED-ONLY, fixer = operator decision.
- [slang#14305 — Vulkan: negative physical-pointer arithmetic gives +4 GB displacement on NVIDIA](14305-vulkan-negative-physical-ptr-arithmetic.md) — human (tdavidovicNV) 11-04. Reproduced on L40S; maintainer-owned (kaizhangNV, RTR, Q1 2027), no bot posts unless asked; triager re-check 11-09. Side bug #14306 HELD (jkwak-work).
- [slang#14298 — Metal combined sampler `Load()`/`operator[]` pass the sampler as the coordinate](14298-metal-combined-sampler-load-subscript-arg-index.md) —
  external (kovidgoyal) 11-04 04:49Z; dup of #10522/#13737, fixed by draft #13741 (triager-verified). Triaged 05:18Z (cmt 6623234116); owner asked to add `Fixes #14298`.
- [slang#14297 — `countof(Tuple<expand Wrap<each T>>)` returns 1, not the pack size](14297-countof-tuple-expand-generic-pack-size.md) —
  maintainer (jkwak-work) self-filed + self-assigned 11-04. TRIAGED P2; draft PR **#14313**, ready-flip pending (weekly list). Side finds #14309 (held, rung 4), #14316, #14318 belong to this chain (issue_opened needs NO dispatch; filed-only).
- [slang#14296 — `__trimFirst`/`__trimLast` value-pack queries fail inside `expand` (E39999/E30105)](14296-pack-query-in-expand-pattern.md) —
  maintainer-filed (jkwak-work) 11-04; TRIAGED P2; draft PR #14314, ready-flip pending (weekly list). Bot side find #14320 belongs to this chain: no dispatch.
- [slang#14295 — extension members on `Ptr<T>`/`T*` not found on a pointer value (E30027)](14295-ptr-extension-instance-method-lookup.md) —
  maintainer-filed (jkwak-work) 11-04; TRIAGED P2; draft PR #14317 (R2 APPROVE_WITH_NITS, master merged in 11-05). READY-FLIP PENDING on jkwak-work.
- [slang#14268 — mixed `Ptr` `==`/`!=` compares nullness via implicit Ptr→bool](14268-mixed-ptr-equality-nullness.md) —
  P2 silent wrong code, TRIAGED; PARKED on maintainer semantics (jkwak-work self-assigned, Q1 2027; joint with #14086), no fixer. Next re-check `t-f032cc` 11-14 16:00Z.
- [slang#14294 — win-test-* (GCP-T4) runners lost at ~03:25Z / ~03:42Z UTC](14294-win-test-runner-loss-0325z.md) —
  bot-filed CI infra. No dispatch, no bot post; 2 jobs spot-verified. Operator already alerted by a sibling session (dashboard seq 510698); I posted nothing more. Recheck 11-05: no recurrence (48 win-test jobs clean); assigned jkwak-work + jkiviluoto-nv, milestone Q1 2027. No timer left.
- [slang#14252 — SM80Plus self-hosted runners stalled since 17:43Z 11-03](14252-sm80plus-runners-stalled.md) —
  bot-filed CI infra (recurrence of #13614). TRIAGED 11-05: infra, medium/intermittent (stall ended 11-03 23:12Z; one 1h49m wait 11-04). HELD: jkwak-work + jkiviluoto-nv assigned 11-04 17:27Z, Q1 2027. No dispatch, no bot post, no timer.
- [slang#14248 — GLSL `inverse(matrix)` only GLSL/SPIR-V; HLSL etc. E36107](14248-glsl-inverse-hlsl-other-targets.md) —
  maintainer (jkwak-work) self-filed + self-assigned 11-03 18:44Z with own proposal. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14247 — `printf` with `ConstantBuffer<uint>` arg → ICE "Unknown legalized val flavor"](14247-printf-constantbuffer-legalized-val-ice.md) —
  human (jkwak-work, self-assigned) 11-03, triaged P2. Draft PR #14253 (frontend fix, +334) **CLOSED by jkwak-work 21:11Z as overkill**; the issue is marked unplanned (workaround: an explicit cast). **CLOSED on our side** 21:16Z (all three coworkers stood down; ack 6615602966).
- [slang#14235 — CUDA global const from pure `[ForceInline]` helper keeps a call under `-g` (G2 from #14150)](14235-cuda-global-const-g-debug-inline.md) —
  human (jvepsalainen-nv) 11-03 07:15Z with own fix PR #14236 (G2 only). #14150 merged 02:06Z with G1+G2 unaddressed. G1 filed as **#14238** (bot, 07:28Z; its `issue_opened` belongs to the #14133 chain, so do not dispatch it). Operator asked 07:30Z about a #14238 fixer chain.
- [slangpy#1258 — intermittent macOS Metal Debug pointer tests read back all zeros](slangpy-1258-metal-debug-pointer-all-zero.md) —
  human (tdavidovicNV) 11-03; triaged P2 (slang-rhi Metal useResource fallback misses pointers inside buffers). **Bot chain CLOSED 11-06**: jkwak-work assigned kaizhangNV, reporter prototyping the fix in slangpy#1266; no rhi filing, no timer.
- [slang#14231 — differentiable generic-extension method via interface param → E33180 (2025+)](14231-tensor-interface-diff-extension-e33180.md) —
  human bug 11-03 (blocks slangpy#1256); §3 fixed by #13742 (ships v2026.21). Draft PRs #14233/#14234 need human Ready. Bot-filed #14237/#14239/#14240 are held for jkwak-work: no dispatch, no fixer.
- [slang#14222 — generic `T(uintVar)` converts through int (≥ 2^31 → negative)](14222-generic-float-init-from-uint-via-int.md) —
  bot-filed side find S1 from the #14062 review, 11-03. P2. **HELD: jkwak-work self-assigned it 11-04 17:19Z (milestone Q1 2027)**, so the bot does not dispatch it, even after #14218 merges.
- [slang#14211 — double core-module constants float-rounded (getPi)](14211-core-module-double-constants-float-rounded.md) —
  bot-filed side find from #14062, 11-02. jkwak-work self-assigned 11-04 (Q1 2027): held, no bot dispatch without their go.
- [slang#14020 — RFC: standard module for small dense linear algebra](14020-dense-linalg-module-rfc.md) —
  human RFC 10-29, triaged P3, no fixer. On 11-02 jhelferty-nv suggested a separate repo + package manager, and on 11-03 the author accepted. **CLOSED on our side** (t-4765e8 cancelled), and the issue stays open. A new human comment is a closed-chain live inbound for the triager.
- [slang#14190 / #14191 / #14192 / #14193 — #14183 side bugs (accessor caps; LLVM atomics; Append/Consume; location-less span text)](14190-14192-cpu-atomic-side-bugs.md) —
  BOT-filed 11-02 ~15:17–15:58Z by the #14183 triager. Filed-only; **their issue_opened needs no dispatch**. **Maintainer-owned** (jkwak-work self-assigned all four 11-02 18:14–18:21Z, milestone Q1 2027); fixer go/no-go withdrawn 11-04, no timer.
- [slang#13251 — out-param lowering wrapper shares the original's DebugFunction](13251-out-param-debugfunc-share.md) —
  latent P3; draft PR #13252 held for owner jkwak-work. **Parked 11-02** after 3 unanswered operator asks; default is to keep holding, no re-chase scheduled.
- [slang#13705 — CPU: unused RTAS global breaks C++ compile; InterlockedAdd E36107](13705-cpu-rtas-placeholder-atomics.md) —
  human bug 10-16. Part 1 = draft PR #13716 @20b86c8bbc, review-complete, **ready-flip pending (weekly list)**, no CI yet. Part 2 (atomics D/E/F) parked on assignee jkwak-work (self-assigned 10-19); split ask withdrawn 11-06, no timer.
- [slang#14183 — CPU `Atomic<float>::add` -> E99999 in emit](14183-cpu-atomic-float-add-ice.md) —
  human bug 11-02 13:33Z, triaged P2 (approach B). Draft PR #14189 @555cf1f, R1 nits applied, ready-flip pending (weekly list). **PARKED 11-06 on jkwak-work: CPU float `add` in #14189 / follow-up / neither?** (reporter ask); one-shot `recheck-14189-scope-d160` 11-13. Side bugs #14190–#14193 need no dispatch; maintainer-owned (jkwak-work self-assigned 11-02), fixer go/no-go withdrawn 11-04.
- [slang#14182 — Metal vector atomics emit `atomic_packed_*`](14182-metal-vector-atomic-packed.md) —
  BOT-filed 11-02 12:39Z by the #14153 fixer (side finding, low priority). Filed-only; fan-out held; **its issue_opened needs no dispatch**.
- [slang#14347 — render-test drops a non-default data layout on untyped object inputs since #14178 (vk `m_data.size() <= destSize`)](13423-metal-cb-scalar-layout.md) —
  BOT-filed 11-05 13:11Z by the #13423 triager (GO (a)). Filed-only; **its issue_opened needs no dispatch**. jkwak-work self-assigned it 11-06 22:06Z (maintainer-held). Record lives in the #13423 chain file; a fixer chain needs the operator.
- [slang#14181 — existential tuple: reflection says 16+N bytes, emit pads it (std140 N<16, CUDA N=4/12); maintainer-driving (jkwak self-assigned, tangent-vector: warn + round up to 16)](14177-render-test-untyped-object-conformance-id-session.md) —
  BOT-filed 11-02 12:34Z by the #14177 triager (side find (b)). Filed-only; **its issue_opened needs no dispatch**. Record lives in the #14177 chain file.
- [slang#14180 — static specialization of an interface-array field passes the AnyValue payload to the concrete method](14177-render-test-untyped-object-conformance-id-session.md) —
  BOT-filed 11-02 12:28Z by the #14177 triager (side find (a)). Filed-only; **its issue_opened needs no dispatch**. Record lives in the #14177 chain file. **11-05: HELD on jkwak-work** (self-assigned 11-02 18:30Z, Q1 2027); operator-asked triage verdict Bug/medium/P2, no fixer.
- [slang#14177 — render-test untyped `new{...}` input takes its conformance ID from slang-rhi's device session](14177-render-test-untyped-object-conformance-id-session.md) — **CLOSED 11-02** by reporter PR #14178 (chain done). slang-rhi#965 held for self-assignee jkwak-work; reporter PR slang-rhi#967 queued for the paused approver.
- [slang#14173 — SPIR-V: `Atomic<float>.sub` aborts with "Unhandled global inst in spirv-emit: neg"](14173-spirv-atomic-float-sub-neg-ice.md) —
  bot-filed 11-02 (#14153 side find); held for self-assignee jkwak-work (Q1 2027): no dispatch, no fixer, no timer. Triaged 11-05 P2 (SPIR-V emit ICE; `.add(-v)` workaround).
- [slang#14174 — Metal: `half` atomics and `groupshared` `float` store emit atomics MSL lacks](14174-metal-atomic-store-half-groupshared-float.md) —
  BOT-filed 11-02 by the #14153 fixer; maintainer-held (jkwak-work, Q1 2027). Triaged 11-05 from live state: bug/low/P3, not covered by #14210/#14170; fix would extend #14210's helper. Operator go/leave open, no timer.
- [slang#14175 — Metal: groupshared float atomic add/sub needs MSL 4.1, but Slang compiles for metal3.1 with no diagnostic](14175-metal-groupshared-float-add-msl41.md) —
  BOT-filed 11-02 11:49Z by the #14153 fixer (side finding). Filed-only; fan-out held; **its issue_opened needs no dispatch**.
- [slang#14162 — float `InterlockedAnd/Or/Xor` accepted on every target](14162-float-bitwise-interlocked-ops.md) —
  BOT-filed 11-02 10:23Z by the #14153 triager (side finding). Filed-only; fan-out held; **its issue_opened needs no dispatch**. **Maintainer-owned** (jkwak-work self-assigned 11-02 18:37Z, milestone Q1 2027); fixer go/no-go withdrawn 11-04, no timer.
- [slang#14153 — Metal `RWTexture2D<float>.InterlockedAddF32` emits non-existent `atomic_fetch_add`](14153-metal-float-texture-atomic-add.md) —
  human bug (albertrodriguezclo) 11-02, maintainer-assigned jkwak-work. **DEFERRED to the reporter's PR #14170** (open 11-06); the bot branch stays local, nothing posted. All coworkers closed; the R6 release run on 11-06 took no action. Resume only on a #14170 close or merge.
- [slang#14160 — Metal emits `[[raster_order_group(0)]]` on a ROV in a compute kernel](14160-metal-raster-order-group-compute.md) —
  human bug 11-02; triaged bug/medium/P2 (Metal emitter, no stage check). Reporter PR #14171 + jkwak-work self-assigned 11-02: the 11-06 R6 release posted nothing. Closed for the bot.
- [slang#14166 — Metal ROV in a ParameterBlock gets no `[[raster_order_group]]`](14166-metal-rov-parameterblock-no-raster-order-group.md) —
  bot side bug from the #14160 triage (DescriptorHandle(ROV) misses the emit hook). jkwak-work self-assigned it 11-02 18:37Z (milestone Q1 2027): held, no bot work. #14171 does not cover it.
- [slang#14152 — `inout IFoo` on a uniform-struct interface field mixes two existential layouts](14152-inout-existential-field-layout-mismatch.md) —
  human bug (albertrodriguezclo) 11-02 10:04Z; Metal rejects, HLSL mistyped, slangc exits 0. Triaged bug/medium/P2, rec A (copy in/out through a tagged-union temp in typeflow-specialize). STOOD DOWN 11-06: reporter PR #14176 (`Fixes #14152`) + shepherd jkwak-work; no bot post, no fixer.
- [slang#14155 — C-like targets emit INT64_MIN as `-9223372036854775808LL`](14155-int64-min-literal-emit.md) — human bug 11-02; reporter PR #14168 MERGED 11-02, issue closed. Remaining c-like/GLSL sites filed by the triager as **#14382** (11-06, unassigned; no dispatch, no fixer chain). Closed on our side. Same value, other layer: #13986.
- [slang#14156 — Metal emits `vector<intptr_t/uintptr_t,N>` as scalar `long`/`ulong`](14156-metal-intptr-vector-emit.md) —
  human bug (albertrodriguezclo) 11-02 10:04Z; Triaged P2, rec A. **CLOSED on our side 11-06**: reporter PR #14164 (`Fixes #14156`) is fix A, waiting on maintainer workflow approval and review; no bot action. (Its 11-02 R6 hold was the retired rule.)
- [slang#14154 — Metal read-only StructuredBuffer/ByteAddressBuffer emitted as writable `T device*`](14154-metal-readonly-buffer-const-device.md) —
  human bug 11-02; triaged bug/low/P2. HELD (rung 4): jkwak-work self-assigned it 11-02 18:38Z (Q4 milestone) and the reporter offered the PR, so no bot post and no fixer. The triager delta draft (gap in option 1: mutable element-pointer temps) is unposted. Check-only re-check r6-release-14154-33ea 11-12.
- [slang#13206 — logical pointers in structs (draft PR #13305)](13206-logical-pointer-struct-legalization.md) —
  draft PR parked on tangent-vector's A/B/C array-scope question since 09-29. The operator ping ask was withdrawn as over-gated on 10-31; the fixer (etva7e) is doing a master merge and a no-ping comment. One-shot 11-07 parks the chain with no timer.
- [Nightly docs/generated exit-code break — slang#14338 (#14269)](nightly-docs-generated-exit-code-14269.md) —
  11-05 nightly red: 80 docs/generated fixtures fail #14269's exit-code check. Triager filed #14338; slang-fixer (`sess-1793866758026-neqvhg`) owns the tests-only draft PR (a human reconcile PR may supersede it). Follow-ups #14339/#14340/#14341 filed-only, not dispatched.
- [Nightly agentic-tests stale fixtures (#13810, #13887)](nightly-agentic-fixtures-13810-13887.md) —
  **TERMINAL 11-03:** jvepsalainen-nv's #14172 fixed all 13 stale fixtures. #13887 is closed as superseded. #13810 is now a +21 PR-CI test draft (`63fb5ef75`) on the weekly ready-flip list. Side find #14134 (formatting.sh unquoted `$@`) is filed-only and parked on a maintainer decision.
- [Nightly sanitizer — render-test gradient NaN cast](nightly-sanitizer-render-test-gradient-nan.md) —
  10-31 nightly UBSan red (`shader-input-layout.cpp:1564-1566`), filed #14121. **TERMINAL:** fixed by jkwak-work's #14163 (our draft #14122 closed as dup); 11-03 nightly green — closed-verified. Side finds slang-rhi#960, #14131.
- [Nightly Coverage red — Pages size budget](ci-coverage-pages-size-budget.md) —
  11-05/11-06 `merge-and-deploy` fails: published site ~950.8 MB over the 950 MB `MAX_CONTENT_BYTES`, growing ~0.8 MB/day. Infra, not code. Triager filed slang-coverage-reports#5 11-06 (filed-only, no fixer); owner picks fewer views / smaller HTML / higher budget.
- [Nightly MDL Perf — simplifyNonSSAIR slower (11-06)](perf-mdl-simplifynonssair-1106.md) —
  IR-pass timers +10–20% on metal/cuda/hlsl. Triager filed #14381 11-06; local bisect culprit 286cdeee4 (#13792, our #13771 chain). Maintainers decide accept or narrow; no fixer by default (operator offered 'go').
- [slang#14112 — modf (float, out int) overload](14112-modf-float-out-int-overload.md) —
  tangent-vector's own feature request (self-assigned), P2, rec A. The reporter is fixing it in their own PR #14353 (Approach A); no bot PR, no fixer.
- [slang#14103 — IGlobalSession::parseCommandLineArguments returns SLANG_OK for invalid arguments](14103-parse-command-line-arguments-ignores-errors.md) —
  **TERMINAL**: PR #14111 merged 11-03, issue closed. Follow-up #14195 HELD (jkwak-work self-assigned), no dispatch. No timer.
  - [Dated history](14103-history-triage-to-ready.md)
- [slang#14214 — SPIR-V constant resource choice across helper call / struct copy → E56004](14214-constant-resource-choice-fold.md) —
  human bug (pdeayton-nv, `bot-ok`; co-assignee tangent-vector), constant-condition sibling of #14101; bug/P2. **STOOD DOWN 11-06**: rung 4 + overlap with draft PR #14358, after an in-place triage update. Webhooks reopen.
- [slang#14101 — SPIR-V `?:` between independently declared Texture2D/SamplerState/Buffer → E56004](14101-spirv-select-independent-resources.md) —
  feature/P2. **CLOSED on our side 11-06**: tangent-vector implements it in draft PR #14358 (no bot PR, no fixer). Side find **#14102** was bot-filed; jhelferty-nv assigned jkwak-work 11-02, so it is held (rung 4) and its webhooks need no dispatch.
- [slang#9643 — overlapping push-constant ranges across vertex/fragment EPs (SPIR-V)](9643-overlapping-push-constant-ranges.md) —
  jkwak-work picked A → PR #14108, **READY 11-06** (jkwak-work flip); head 9b77f0de8 (codes renumbered to 31167–31170 after a collision with #14051); CI waiting on falcor-ci approval; Q1/Q2 still unanswered at the final re-check 26da (11-11); S1 filing held; **PARKED on the supervise-issues register, no timer**. Related: slangpy#1232 / #13713.
- [slang#14071 — CUDA separate-sampler SampleGrad rejected vs SampleLevel dropping the sampler](14071-cuda-separate-sampler-samplegrad.md) —
  P3 feature ask, PARKED for assignee jkwak-work on A/B/C; re-checked 11-10 (no change); last one-shot `t-7858dd` 11-17 00:10Z, then webhooks + supervise register only. Owns #14073 (closed) and #14083 — no dispatch on their webhooks.
  - [Dated history](14071-cuda-separate-sampler-history.md)
  - [#14073 spin-out history (closed)](14073-cuda-gather-spinout-history.md)
- [slang#14077 — DXR CreateStateObject crashes (NVIDIA) for TraceRay in a `[noinline]` helper](14077-dxr-noinline-traceray-pipeline-crash.md) —
  P3; likely a driver issue (DXIL matches DXC). Parked on the reporter; re-check t-c511aa ran 11-03 (no reply; reporter's fork draft rejects a compiler workaround); no timer left, no fixer.
- [slang#14075 — generic `where T.A == C` does not satisfy an interface `__constraint` equality (E38029)](14075-generic-assoc-equality-conformance.md) —
  human bug (kaizhangNV, MEMBER, self-assigned) 10-30 00:19Z, portable-RT. Triaged bug/medium/P2; distinct from #13509 (equality-side sort + one-way isSubtype; order-dependent). Bot comment 6592159047 posted 11-03. PARKED on the reporter's go-ahead; t-567683 (11-10) still silent, milestoned Q1 2027 — maintainer-driving, no timer.
- [slang#14070 — DXIL `[noinline]` helper calling IgnoreHit fails DXC validation](14070-dxil-noinline-ignorehit-validation.md) —
  human bug (kaizhangNV, self-assigned), P2, rec A. Bot comment 6591620569 posted 11-02 23:59Z (+`reproduced`, Type=Bug). Parked on the reporter's go-ahead; triager gated re-check i14070-reporter-recheck-e308 11-10.
- [slang#14069 — MSVC 2019 ICE C1001 on `constexpr std::to_array` in unit-test-string.cpp](14069-msvc2019-ice-unit-test-string-to-array.md) —
  human build-break regression (minco3, NONE) 10-29, from #13217. **TERMINAL 11-02**: the reporter's PR #14072 (fix A) merged 22:32Z as `8e0a545`; no bot fixer. Option D (drop vs2019 presets/docs) still the operator's call.
- [slang#12972 — RFC: aliased imports + using (design-gated) + E30600 follow-up](12972-module-import-alias-rfc.md) —
  tangent-vector RFC, fixer held since 09-08. 10-29: the E30600 module-qualifier diagnostic is spun out as bot-filed **#14063** → draft PR **#14074** (slang-fixer; parked on maintainer review + CI gate 10-30), owned by this chain (do not dispatch its issue_opened).
- [slang#14067 — `-validate-ir` aborts on a legal `throw` terminator (getSuccessors lacks kIROp_Throw)](14067-ir-validate-throw-terminator.md) —
  human bug (kaizhangNV, MEMBER, self-assigned) 10-29 23:14Z, sibling of #14066. R6 crash-exempt. Triaged bug/medium/P2 (fix A: `case kIROp_Throw` in getSuccessors); bot comment 6510939393 posted. PARKED on the reporter's bot-PR go-ahead; triager re-check t-537822 11-02 23:30Z.
- [slang#14066 — Result<void,E> error extraction returns the result struct](14066-result-void-error-extraction.md) —
  reporter-owned (kaizhangNV). CLOSED 10-30 by their PR #14068 (fix A, d34a5eb54); no bot post, no fixer. Terminal.
- [slang#14062 — generic `T(0.1)` over __BuiltinFloatingPointType rounds through float for double](14062-generic-float-literal-rounds-through-float.md) —
  human bug (albertrodriguezclo) 10-29, P2. Draft PR #14218 reviewed APPROVE_WITH_NITS 11-03; waiting on jkwak-work to un-draft; timer `recheck-14062-pr14218-55f1` (11-10). Side finds #14211/#14222 filed-only.
- [slang#14061 — SPIR-V double log/exp/pow/sin → invalid GLSL.std.450, no diagnostic](14061-spirv-double-glsl450-transcendentals.md) —
  human bug (albertrodriguezclo) 10-29 22:05Z. Triaged bug/medium/P2 (fix layer: core-module intrinsics; rec. `static_assert(!__isDouble<T>())`). Posted 11-02 (Type=Bug, `reproduced`); parked on assignee jkwak-work (A vs B). Final re-check recheck-14061-maintainer-aa6e 11-09 22:30Z.
- [slang#14059 — `cond ? ptr : nullptr` rejected (no `?:` overload for Ptr/NullPtr)](14059-ternary-ptr-nullptr-overload.md) —
  human bug (cloth-sim batch 3), P2; fix A in `TryJoinTypes`. DRAFT PR #14219 @5ab02f8 (fixer `qcgux1`, R1 APPROVE_WITH_NITS applied; adds a CUDA/C++ `_slang_select<T>` emit commit). RESTING on jkwak-work review + ready flip; stand down if they claim it.
- [slang#14053 — overloaded same-name compute entry points → invalid CUDA/Metal/SPIR-V, no diagnostic](14053-overloaded-entry-points-same-name.md) — P2; draft PR #14221 review-complete, MERGEABLE (behind, no conflict); ready-flip carried to the 11-16 weekly list (left out of 11-09 by the cap); parked after r2, no timer. Owns #14228–#14230 (no dispatch).
  - [Dated history](14053-history-triage-to-ready.md)
- [slang#14054 — Metal compareExchange is a single weak CAS (spurious failure reads as success)](14054-metal-weak-compare-exchange.md) —
  human bug (albertrodriguezclo, cloth-sim batch) 10-29 21:51Z; Metal twin of #13917/#13918. Triaged 22:08Z: premise contested (MSL spec reads strong). Park posted 11-02 21:56Z; awaiting assignee jkwak-work; 11-06: reporter offered own PR. 11-09 t-c62394: reporter PR #14404 (ready, `Fixes #14054`, bit-compare verified) awaits jkwak-work review; no bot fix, no timer; positive close-out on merge.
- [slang#14058 — Metal discarded atomic results → `-Wunused-variable` temps](14058-metal-discarded-atomic-unused-variable.md) —
  human bug, P2, widened to all 0-use calls. Draft PR #14209 master-merged 11-10 (`e6a5574e1`, MERGEABLE), reporter answered, mapping on `uy6784`; ready-flip on the weekly list, no timer. Owns filed-only #14216. ⚠️ Overlaps #14044/#14170.
  - [Dated history](14058-history-triage-to-merge-master.md)
- [slang#14057 — warn when an unsuffixed float literal is rounded to float then used as double](14057-unsuffixed-float-literal-double-warning.md) —
  human feature request 10-29, P3, reproduced. PARKED on 4 jkwak-work/skiminki-nv decisions (reporter's 11-06 answers are not a maintainer decision); webhook-only, no timer. Overlaps #14062 and stale bot draft #12932 (detail in the record).
- [slang#13685 / draft PR #13700 — all-undefined Texture2D phi → E56004](13685-undefined-texture-phi-fold.md) —
  R4 APPROVE_WITH_NITS; merge blocked on pdeayton-nv's R2/R8 choice and on spirv-val rejecting image `OpUndef`. That blocker is **#14076** (fix = draft PR #14081), owned by this chain: do not dispatch its issue_opened.
- [slang#14056 — no diagnostic for a group barrier after a thread-dependent `return`](14056-group-barrier-after-divergent-return.md) —
  human feature request (albertrodriguezclo) 10-29, P2, reproduced. 11-02: assigned to jkwak-work; bot 5-bullet posted 21:56Z (6589464727). PARKED on the assignee picking A–D; no timer, parked register.
- [slang#14039 — unused ByteAddressBuffer + `-preserve-params` ICE in spirv-emit](14039-bab-preserve-params-spirv-ice.md) —
  human bug (pdeayton-nv, `bot-ok`) 10-29, P2. **MERGED** as PR #14045 on 11-02 19:50Z (2518a942d), and the issue is closed. Terminal.
- [slang#14065 — WGSL WaveSize → @subgroup_size PR (jkwak-work)](14065-wavesize-wgsl-subgroup-size.md) —
  approver queued (paused); 10-30 maintainer filing ask (checks before simplifyIR) → filed as #14095 (assigned jkwak-work).
- [slang#14000 — AST-to-IR lowering adds linkage decorations to non-public functions](14000-linkage-decorations-non-public.md) —
  maintainer-filed; parked on tangent-vector choosing A/B/C. Walked by `/supervise-issues` as awaiting_human; no extra timer.
- [slang#14091 — SIGSEGV compiling slang.numerics code with `-obfuscate`](14091-numerics-obfuscate-sigsegv.md) —
  split: draft PR #14092 (crash→error, AWN applied, ready-flip pending → weekly list); bug 2 (std modules under `-obfuscate`) assigned to jkwak-work 11-02, parked in supervisor-state (t-e356e3 fired 11-06, no news).
- [slang#14089 — `void*` arithmetic: 4-byte stride on SPIR-V vs error/1-byte on C-like targets](14086-14089-pointer-semantics-parked.md) —
  BOT-filed 10-30 04:58Z by slang-triager (a #14088 side find), P2. PARKED on assignee jkwak-work (since 11-02) choosing the semantics; no timer after the 11-06 t-e18700 re-check (supervisor-state `parked:maintainer-decision`). Its `issue_opened` webhook needs no dispatch. Spawned by the #14055 chain.
- [slang#14087 — SPIR-V `(int64_t)ptr` emits OpConvertPtrToU with a signed result (spirv-val)](14078-pointer-emit-pr-stack.md) —
  BOT-filed 10-30 04:33Z by slang-triager (exposed by #14080's test). PR #14090 MERGED 11-02 22:14Z by jkwak-work (dd93102a4); #14087 CLOSED. TERMINAL. (Its ready_for_review webhook was not forwarded; the approver is paused.) Its `issue_opened` webhook needs no dispatch. Spawned by the #14055 chain.
- [slang#14086 — explicit narrow-int cast of a pointer gives `ptr != nullptr` (0/1), no diagnostic](14086-14089-pointer-semantics-parked.md) —
  BOT-filed 10-30 03:54Z by slang-triager (a #14080 side find), P2. PARKED on a maintainer choosing the diagnostic shape; one-shot t-fb3521 11-06 16:00Z. Its `issue_opened` webhook needs no dispatch. Spawned by the #14055 chain.
- [slang#14084 — GLSL `bit_cast<uint64_t>(double)` requests no int64 extension](14078-pointer-emit-pr-stack.md) —
  bot-filed side find of #14080, P3; draft PR #14085, R1 nits applied. PARKED on the operator ready flip, then maintainer review. Its `issue_opened` needs no dispatch.
- [slang#14082 — GLSL buffer-ref emit: null as `0`, signed int→ptr ctor, `void _data`](14078-pointer-emit-pr-stack.md) —
  BOT-filed P3 (a #14080 side find, owned by the #14055 chain; no dispatch). Draft PR #14088 R2 APPROVE, stacked on #14080; after it merges, merge (not rebase) to retarget.
- [slang#14078 — GLSL ptr→ptr cast `(float*)intPtr` → E99999](14078-pointer-emit-pr-stack.md) —
  bot-filed side find of #14055; draft PR #14080 (AWN, 0 bugs) PARKED on the operator ready flip. Signed direct-SPIR-V case → #14087. Its `issue_opened` needs no dispatch.
- [slang#14055 — parser takes `a * *p` as a pointer type (E20001)](14055-parser-multiply-deref-pointer.md) —
  human regression from #6627 (albertrodriguezclo), P1, assignee jkwak-work. **Draft PR #14203** @ 5872fb173 (R2 APPROVE_WITH_NITS) PARKED on the ready flip or the assignee. Owns side finds #14078/#14082/#14084/#14086/#14087/#14089 and #14205–#14208 (no dispatch).
  - [Dated history](14055-history-triage-to-pr.md)
- [#14055 side finds filed-only — #14205 render-test `-entry`, #14206 GLSL bit_cast intptr, #14207 SPIR-V null Workgroup ptr, #14208 NVIDIA PSB bitcast crash](14205-14208-pointer-side-finds-filed-only.md) —
  bot-filed 11-02, filed-only; jkwak-work backlog pass 11-04 (Q1 2027, rung 4). #14205/#14206 verdicts by Main 11-05 (P3); #14208 triaged 11-05 12:02Z (driver bug, P2; re-check 11-12). Fixers need the operator's go. **Their `issue_opened` belongs to the #14055 chain, do not dispatch.**
- [slang#14031 / PR #14044 — Metal 64-bit atomics](14031-metal-64bit-atomics-pr14044.md) —
  bot draft, fixer uqb9b4, jhelferty-nv. Merged master + check moved to checkUnsupportedInst (b360ff2a7); no CI has built it (docs-only tip). PARKED on reporter's M4 xcrun check (11-06); re-check recheck-14044-reporter-m-da20 11-10 23:00Z.
- [slang#14060 — Metal rejects `Atomic<float>` load/exchange/CAS (E55204)](14060-metal-float-atomic-load-exchange-cas.md) —
  ✅ MERGED 11-05 21:53Z as 37fc7aa7d via PR #14210 (jkwak-work); issue closed. Human (albertrodriguezclo) P2. #14044 owner told to move its check into checkUnsupportedInst.
- [slang#14035 — Metal/WGSL reject `&ptr[i]` (`operator&` gated cpp_cuda_spirv_llvm)](14035-metal-wgsl-address-of-device-pointer.md) —
  human feature request (albertrodriguezclo) 10-29, cloth-sim batch, P3, reproduced. Type and `reproduced` set. PARKED on jkwak-work/aidanfnv (A widen gate / B diagnostic / C #10206) because `&` is slated for deprecation; 5-bullet posted 11-02 (6583479145); assigned jkwak-work 11-02; no timer, register-only after 11-09.
- [slang#14398 — CPU/CUDA module-scope `static const` `vector op scalar` not widened](14398-cpu-cuda-static-const-vector-scalar-widening.md) —
  bot-filed 11-07 by slang-triager, a side find from the #14396 review (#14036 chain). **Its `issue_opened` belongs to #14036, do not dispatch.** Filed-only, not a regression, related to #14330.
- [slang#14036 — CUDA `precise` / `-fp-mode precise` → `_rn` intrinsics (FMA contraction)](14036-cuda-precise-fp-mode-rn-intrinsics.md) —
  human (albertrodriguezclo) 10-29, P2. Bot DRAFT PR #14396 @855c4635c (R2 APPROVE_WITH_NITS). **11-08: the author opened human PR #14405, which duplicates it. Operator asked 11-09 whether to stand down; #14396 stays OFF the weekly ready-flip list until answered.** Owner slang-fixer `2rqq4g`.
- [slang#14037 — CUDA source output needs `-DSLANG_CUDA_ENABLE_HALF` for `half`](14037-cuda-half-enable-define.md) —
  human bug (albertrodriguezclo) 10-29, P2. DRAFT PR **#14194** (R2) PARKED on humans: a maintainer must commit the CI-step hunk (bot lacks `workflows`), then un-draft; ready-flip pending (weekly list). Side finds #14196/#14199 held (self-assigned). Detail in the record.
- [slang#14034 — WorkgroupCount() on CUDA (gridDim) / Metal ([[threadgroups_per_grid]])](14034-workgroupcount-cuda-metal.md) —
  human feature request (albertrodriguezclo) 10-29, P2, reproduced. Fix = the #13920 WGSL pattern for cuda/metal. Assigned to jkwak-work 11-02 (rung 4: no bot post). PARKED on the jkwak-work/Yong design call on sibling #14148. FINAL one-shot `t-d38249` 11-16 17:15Z, then webhook-only.
- [slang#14151 — Metal `SV_GroupIndex` subscripts a narrowed scalar `SV_GroupThreadID`](14151-metal-groupindex-scalar-groupthreadid.md) —
  human bug 11-02, P2. ✅ FIXED by jkwak-work PR #14326 (merged 11-05), verified 11-06; fixed-by note posted, issue left OPEN for the maintainer. **TERMINAL**, no timer.
- [slang#14157 — Metal/WGSL `ByteAddressBuffer` `bool` load/store bit-cast](14157-metal-wgsl-bab-bool-bitcast.md) —
  human bug 11-02; Triaged Bug/P2 (Approach A); reporter PR #14167 open. Side finds (#14328, #14329, …) are filed-only, no dispatch. PARKED on maintainer review: after a meeting 11-06, jkwak-work accepts that type sizes differ by target and will review #14167 and propose fixes. No post, no fixer, no timer; register entry in supervisor-state.
- [slang#14136 — Metal `[[threads_per_threadgroup]]` / CUDA `blockDim` (dispatched group size)](14136-metal-threads-per-threadgroup.md) —
  human feature request (albertrodriguezclo) 11-01, P2, reproduced (no Metal workaround). **Reporter PR #14148** (`DispatchedWorkgroupSize()`, approach A; `Fixes #14136`) was verified by the triager on the L40S 11-05 (`t-c5502a` done). It waits on jkwak-work (fork CI approval, label, review). No bot work and no re-check. Host side: slang-rhi#961.
- [slang#13632 — `nullptr` compare → E99999 on HLSL/WGSL](13632-ptrlit-nullptr-hlsl-wgsl-e99999.md) — bot draft PR #13856 @38bcad8;
  parked on jkwak-work's `-skip-spirv-validation` answer (since 10-22); gates reporter's #13652 cut-down; reporter confirmed fix 11-06.
- [slang#14026 — float atomic min/max per target](14026-float-atomic-min-max.md) — human-filed 10-29; 3 draft PRs
  #14046 GLSL / #14047 HLSL diag / #14048 CUDA, awaiting maintainer review; 11-06 reporter's SM 6.6 CAS follow-up idea (not filed).
- [slang#14027 — parallel-primitives standard module (block/device scan, reduce, sort)](14027-parallel-primitives-standard-module.md) —
  human feature/design proposal (albertrodriguezclo) 10-29, P3. CLOSED 11-02: the reporter goes package-first, and the stand-down was posted (6582500256). It filed #14140 (CUDA globallycoherent). My 10-29 R6 flag was wrong: merged R6 has no wait.
- [slang#14311 — D3D nested-struct layout: StructuredBuffer vs raw `Load<T>` vs reflection](14311-d3d-nested-struct-structured-vs-raw-layout.md) —
  human-filed 11-04, assigned kaizhangNV (routing). Triaged 17:56Z (cmt 6637980577) and parked on a maintainer pick: (A) D3D SB reflection fix A1–A4, (B) raw/structured contract B1–B4. 11-04 jkwak-work self-assigned; 11-11 re-check unchanged → parked-chain register, webhook-only.
- [slang#12714 — layout rules: docs #12716 + `-layout-rules-version 202c` draft #13300](12714-layout-rules-version.md) —
  parked since 10-01 on jkwak's GLSL pick, then tangent-vector concurrence; triager owner `…1053r5` (not zjzu07, which is the fixer). 10-29 cloth-sim pointer-layout comment reproduced + answered. 11-02: over-gated operator menu withdrawn; no-ping nudge on #13300; master merge deferred to jkwak's pick. 11-09: quiet; next free enum 165; 11-16 run parks it.
- [slang#14032 — struct alignment control (`[Align(N)]`)](14032-struct-alignment-attribute.md) —
  feature P2, **human-owned** (assignees jkwak-work + skiminki-nv, 11-02); no fixer handoff unless asked; parked 5-bullet 6583572483; 11-09 re-check found no change; next `t-8b7ca5` 11-23 17:20Z. CUDA side bug **#14040** is owned by this chain (its webhook needs no dispatch).
- [slang#14029 — CUDA grid-wide sync intrinsic + cooperative-launch reflection](14029-cuda-grid-sync-cooperative-launch.md) —
  human feature request (albertrodriguezclo) 10-29, P2. Triaged; side finding: `-target ptx` + `<cooperative_groups.h>` fails on NVRTC 12.6 (prelude typedef clash). 11-02 assigned to kaizhangNV (by jhelferty-nv). The bot chain CLOSED 11-09: maintainer-owned, no timer; it reopens only on a webhook or an operator ask.
- [slang#14013 — explicit vk::binding(0) + global uniform, CB binding on the scope var layout](14013-vk-explicit-binding-global-cb-reflection.md) —
  bot DRAFT PR #14023, review-complete. **PARKED, NO TIMER since 11-04**: ready-flip HELD on the maintainers' landing-order decision with slang-rhi#959 (owned here, no dispatch). Reopens on a human comment or "un-draft 14023".
- [slang#8557 — Std430DataLayout missing, GLSL→WGSL](8557-glsl-to-wgsl-std430datalayout.md) —
  maintainer re-triage ask (jkwak-work) on 10-28. Verdict: #13908 alone doesn't fix it, and it can close once human PR #13935 merges. PARKED on the maintainer. r1 fired 11-04: #13935 still open → no action, no re-arm; weekly parked digest covers it.
- [slang#13982 — `-g` emits DebugSource for an unused imported module](13982-spirv-debugsource-unused-import.md) —
  external report (jhelferty-nv retyped it Bug→Feature 11-04), P3; bot draft PR #13992 (module-version collision). Re-chase cap hit 11-05 (r3): PARKED in the parked-chain register, no timer. Open: operator un-draft (asked 3×, now on the weekly list) and the #7203 maintainer question (jhelferty-nv asked tangent-vector 11-04).
- [slangpy#1227 — Vulkan .bwds() gradient in grad[0,0], RTX 5090 driver 617](slangpy-1227-vulkan-bwds-grad-rtx5090-driver.md) —
  bot-filed off the #1167/#1225 chain. 10-28 jkwak-work took it over (driver bug route). Optional operator "repro" offer, default nothing; no timer.
- [slang#13804 — SPIR-V decorations on global resource OpVariables](13804-spirv-decorations-global-resources.md) —
  feature request, P2. Side-bug crash fix is bot draft PR #13809 (kaizhangNV, 0 reviews). The feature waits on tangent-vector (assignee) to pick A/B/both. PARKED 10-28 in the register after re-check t-26dd74 found no change; no re-arm.
- [slang#13964 — HLSL default-inout receiver rejects immutable receivers](13964-hlsl-default-inout-receiver-immutable.md) —
  regression from #13615, P1; bot draft PR #13966 (new warning E30134), design settled 10-28. PARKED, no timer (3 un-draft asks unanswered; re-chases used up 11-05); on the weekly un-draft list; reopen with "un-draft 13966".
- [slang PR #13911 — WGSL WaveGetNumWaves; Dawn follow-up issue](13911-wgsl-wave-get-num-waves-dawn-followup.md) —
  fork PR, APPROVED. Bot filed follow-up #13967 (assigned jkwak-work); terminal for the bot.
- [slang#13011 + #13061 — optional-constraint lookup leak](13011-optional-constraint-lookup.md) —
  slang-fixer (session `ex6aw0`) released 10-30 → draft PR #14096 fixing both; the guarded-call gap is filed as #14127 (same owner).
- [slang#13948 — structType assert, pointer field of a local struct copy passed to a function](13948-ptr-field-local-copy-structtype-assert.md) —
  bot DRAFT PR #13951 (AWN applied): ready-flip pending, on the weekly un-draft list (`weekly-undraft-list-4573`); per-PR asks stopped after #3 (11-03), no timer. Owner: slang-fixer `sess-1792961824237-auyd5v`.
- [slang#13904 — WGSL ScalarDataLayout CB: emitted stride vs std140 reflection](13904-wgsl-scalar-cb-layout-reflection.md) —
  human-filed (albertrodriguezclo) 10-25 and triaged P2. The reporter's PR #13935 was verified at a2ee40c. PARKED on jkwak-work (capability gate) and dshreiner-nv/kaizhangNV (review), with no fixer and no timer. ⚠️ It shares the one-line `isWGPUTarget` change with bot draft #13402.
- [slang#13902 — WGSL static const arrays exceed the 8192-byte private limit](13902-wgsl-static-const-array-private-limit.md) —
  human-filed (albertrodriguezclo) 10-25 with own PR #13903. HELD, nothing dispatched. ⚠️ #13903 breaks the `kFinite` `var<private>` CHECK in bot draft #13669; whichever merges second updates it.
- [slang PR #13473 — Metal resource-array KernelContext copies](13473-metal-resource-array-context-copy.md) —
  fork PR (tomaszbk) restarted as bot-filed #13894, now jkwak-work's (Q4). Maintainer-owned; resume on an @nv-slang-bot mention. Owner: slang-fixer `sess-1792777720128-uwee1o`.
- [Staged drafts](drafts/index.md) - triager drafts not yet filed on GitHub
- [slang#12630 — Texture1D.Load for CUDA/PTX](12630-texture1d-load-cuda.md) —
  DRAFT PR #13377 (0 CI runs) waiting on two jkwak-work decisions; follow-up #14064 owned here (no dispatch). 3 operator asks unanswered; "resume 12630" re-arms the 3-day re-check.
- [slang#13750 — `using namespace` vs local/global name conflicts](13750-using-namespace-conflict-resolution.md) —
  human-filed (skiminki-nv) design question. Tentative C++ direction 10-21 superseded 10-26 by #13956 (202c overhaul). Bot plan withdrawn. HELD on the assignee. 11-09 re-check `t-ab041d`: #13956 rule 6 now reads C *or* A (10-29) and goes to the 202c spec process; cmt 6315330488 corrected in place 19:08:58Z (verified); no re-check pending.
- [slang#13888 — spurious outer-scope candidates for ambiguous lookup](13888-ambiguous-lookup-spurious-candidates.md) —
  CLOSED WNF 10-26 by skiminki-nv (issue + PR #13889); superseded by the 202c overhaul, tracked in #13956. Terminal; re-chase cancelled.
- [slang PR #12674 — attribute-name parsing](12674-attribute-name-parsing.md) —
  bot PR pushed 10-24 (head c7879c5a31), CI green. **Parked on maintainers**; webhooks deliver replies to the fixer.
- [slang PR #11387 — autodiff readNone carry gate](11387-autodiff-readnone-carry-gate.md) —
  bot PR waiting on jvepsalainen-nv (A)/(B) + #12502 placement; CI green bar falcor. Next one-shot `rechase-11387-maintainer-21db` (11-14).
- [slang#13877 — packed StructuredBuffer record loads stay scalar on CUDA/Vulkan](13877-packed-structuredbuffer-scalar-loads.md) —
  member perf report, triaged 10-22. **TERMINAL 10-29**: human-owned (kaizhangNV, Q4). Resumes only on a human comment.
- [slang#13865 — `/format` fails: slangbot push + comment 403](13865-format-slash-command-slangbot-pat-403.md) —
  maintainer CI-credential issue (jkwak-work). Assignee chose the org App-token design; jkiviluoto-nv raised a security blocker. HELD; resumes only on a bot mention or an operator GO.
- [slang#13752 — missing shadowing diagnostics](13752-shadowing-diagnostics.md) —
  skiminki-nv self-assigned. Part 1 = DRAFT PR #14093 (bot peer review done); waits on skiminki-nv for Q3 and a human ready-mark. Part 2 parked on Q1–Q2. SlangPy rename shader-slang/slangpy#1254 MERGED 11-02 (`a78ea62e6`). Re-check `recheck-13752-14093-606d` 11-05 12:00Z.
- [slang#13757 — slangd crashes on an array `settings` in didChangeConfiguration](13757-slangd-array-settings-crash.md) —
  bot-filed 10-20 by the #13179 fixer; maintainer-assigned to tangent-vector, milestone Q4 2026. Held; 1-line fix ready on an operator GO or `bot-ok`.
- [slang#13807 — `-wgpu -render-feature half` rows always ignored on NVIDIA](13807-wgpu-half-tests-ignored-dawn-shaderf16.md) —
  bot-filed 10-21 by the triager on jkwak-work's #13647 ask; assignee jkwak-work says "slang-rhi issue". Triage verdict given 10-22 (test infra / slang-rhi, low, P2). Held; resumes on a bot mention or an operator GO to file in slang-rhi.
- [slang#13841 — DebugDeclare on real storage](13841-debug-declare-real-storage.md) —
  Draft PR #13872 open; design rejected 10-30, redesign tracked by #14106 (fixer efb8e6, no dispatch); phase-1 draft #14114 waits on its ceiling. Detail (incl. stable-id 910 collision) in the record.
  - [PR #13872 history](13841-pr13872-history.md) · [#14106/#14114 redesign history](13841-debuginfo-redesign-history.md)
- [slang#13875 — update mimalloc v2.1.7 → v2.5.2](13875-mimalloc-bump-2-5-2.md) —
  pdeayton-nv filed + self-labelled `bot-ok` 10-22 (follow-on to #13827). Fixed by PR #13879, **MERGED 10-26 23:26Z** (`f80573815`); issue closed. Terminal; r2 re-chase cancelled.
- [slang#13828 — memory retained after unloading Slang DLLs with mimalloc](13828-mimalloc-dll-unload-memory.md) —
  Fixed by PR #13867, **MERGED 10-29 06:28Z** (`01dcd3568`, head `b8093c48b`); issue closed. Terminal. MSVC/clang-cl
  only; MinGW scope never answered, so MinGW stays untracked unless a human files a follow-up.
- [Hosted ubuntu-latest pickup lag, Oct 2026](hosted-runner-pickup-lag-2026-10.md) — 4+ episodes 10-27→10-30; not the bot, not the 60 cap; needs an org Actions admin; don't re-alert per episode.
- [slang#13238 — per-derivative DebugFunction](13238-autodiff-derivative-debugfunction.md) —
  bot draft PR #13239 PARKED on jkwak-work (R2 APPROVE_WITH_NITS at `6850aac48`). Owns follow-ups #14128, #14129 (no dispatch, no fixer). #14128 human-assigned to pdeayton-nv 11-02.
- [slang#13827 — duplicate operator new/delete with newer mimalloc on Windows](13827-mimalloc-windows-duplicate-operator-new.md) —
  pdeayton-nv (reporter + assignee). DRAFT PR #13850 @aedafd686 (`MI_OVERRIDE OFF` once), R1 APPROVE_WITH_NITS applied; triage resolved 10-22 01:26Z. **MERGED 10-22 17:41Z** (`80e4385a4`, merge queue); #13827 closed. Terminal.
- [slang#13840 — test coverage for modern-style syntax](13840-modern-syntax-test-coverage.md) —
  MEMBER-filed (jhelferty-nv) 10-21 21:40Z, Type=Testing; assigned to tangent-vector (10-26). Held 10-21, then triaged 10-29 on the operator's ask (cmt 6495725468, medium); the incident was our bot PR #13406. Parked on tangent-vector (A vs A+B), re-check t-950df7 11-05.
- [slang#13767 — WGSL `[numthreads]` spec constant → `override` in `@workgroup_size`](13767-wgsl-numthreads-spec-const-override.md) —
  DRAFT PR #13826 (R2 AWN applied) 11-06 reporter asked to undraft; merged master @51ff5237fa (0 behind, re-verified), CI 42311658282 waiting; ready-flip pending (weekly list 11-09, shepherd jkwak-work); falcor-ci waiting. Operator: 3 filing GOs pending.
- [slang#13824 — render-test binds a Texture2D.Handle input as a Vulkan storage image](13824-render-test-texture-handle-storage-image.md) —
  terminal 11-05: PR #13829 merged as 04d2726db0 (jkwak-work); issue closed as completed. 2 unfiled side bugs still await the operator (asked once, not re-asked).
- [slang#13817 — type-flow: generics over a dynamic associated type, two conformances](13817-typeflow-dynamic-assoc-type-two-conformances.md) —
  DRAFT PR #13820 PARKED on assignee saipraveenb25's scope reply (cmt 6475284726). No change at `6f27` 11-07; next one-shot `recheck-slang-13817-5e23` 11-14 17:30Z.
- [slang#13789 — isParameterLocationUsed on a split mixed constant buffer](13789-isparameterlocationused-mixed-cb-split.md) —
  external (fuchstraumer) 10-20. Triaged (cmt 6298782357, P2). Cause in type legalization. DRAFT PR #13811 @8921fd5 (fixer `4lrs0a`), BEHIND, 0 reviews, CI at falcor gate. PARKED on assignee jkwak-work (silent since 10-21) + 2 operator filing calls (unanswered). 11-04: albertrodriguezclo confirms on Metal/HLSL; triager verifying #13811 on that shape.
- [slang#13795 — `-O0 -separate-debug-info` loads the spirv-opt wrapper](13795-separate-debug-info-o0-loads-spirv-opt.md) —
  CLOSED 10-22: bot PR #13801 merged by the assignee (e485e78). Open, outside the chain: operator call on filing the link+split+optimizer crash.
- [slang#13396 — self-referential struct pointer: "circularity during codegen"](13396-self-referential-struct-pointer-circularity.md) —
  bot-filed 10-02. DRAFT PR #13400 @b85731f2ce, owner fixer session `njpemm`, pinned send only. The HLSL/WGSL test legs are coupled to reporter PR #13652 (E55219). The nullptr side finding is already #13632. Ready flip waits on the operator.
- [slang#13126 — `ByteAddressBuffer.Load<S>()` passed to a call segfaults](13126-byteaddressbuffer-load-alignment-operand-drop.md) —
  DRAFT PR #13130 (peer review APPROVE); CI sits `waiting` on `falcor-ci`, so re-dispatch is futile. Blocked on falcor-ci approval + P2→P1 (operator). **PARKED 11-04, no timer** (re-chase cap); reopens on gate expiry ~11-19, a human comment, or a ci-approvers action.
- [slangpy#1232 — Vulkan module `[[vk::push_constant]]` silent wrong results](slangpy-1232-vulkan-module-push-constant.md) —
  all coworker tiers closed. Split into [slangpy#1235](slangpy-1235-push-constant-fail-loudly-pr.md) (APPROVED, HELD by jkwak-work until the slang/rhi fixes land) and [slang#13713 → PR #13724](slang-13724-multiple-push-constant-blocks-e39033.md) (MERGED 10-20). Operator items: rhi#810, #915, GLSL export.
- [slang#13733 — WGSL loop increment-in-body vs Tint robustness](13733-wgsl-loop-increment-tint-robustness.md) —
  option A taken by the reporter's PR #13740 (CI green, 0 human reviews; review requested from jkwak-work, escalated). Ask 2 (`[unroll]` warn) unowned. Triager one-shot `t-b53ffe` 11-07 15:00Z.
- [slang-rhi#954 — bindAsRoot reserves 1024/1024 states per root object](slang-rhi-954-bindasroot-state-capacity.md) —
  triaged 10-29 (P3 perf; bot cmt offers j8asic the PR). PARKED on skallweitNV (A grow vs B layout-sized) since jhelferty-nv's 11-02 ping. Triager final one-shot t-d2013a 11-10 08:00Z.
- [slang-rhi#956 — WebGPU readBuffer staging buffer per call](slang-rhi-956-wgpu-readback-staging-reuse.md) —
  triaged 10-29 (bot cmt welcomes j8asic's PR, no bot fix). HELD on maintainer jkwak-work (self-assigned + Q4 milestone 11-04); bot stands down, no timer. #953 merged 10-29. Couples to #862/#869.
- [slang-rhi#928 — Vulkan ReadBack on uncached host memory](slang-rhi-928-vulkan-readback-uncached.md) —
  **CLOSED 10-21** by reporter PR #929. Couples to our draft rhi#869 (CONFLICTING, update sent to slang-fixer 10-27) and rhi#722 (VMA).
- [slang#13770 — GCC stringop-overflow warning in unit-test-string.cpp](13770-unit-test-string-memcpy-warning.md) —
  human-filed (spate) 10-20 build warning (GCC≥14 `-Wstringop-overflow` false positive in `List<long>::reserve`). **MERGED** 10-22 19:05Z via PR #13782 (`ea4b88f`, `SLANG_ASSERT(m_count <= m_capacity)`); issue closed completed. Observe-only. Operator: 6 unfiled `List` follow-ups.
- [slang#13765 — WGSL vector builtins emitted as VECTOR_MAP_UNARY loops](13765-wgsl-vector-map-unary-loops.md) —
  TERMINAL 10-23: reporter PR #13781 MERGED 10-22, issue closed, triager-verified on master. Side findings unfiled (operator).
- [slang#13519 — SeqCst VUID-10866](13519-seqcst-vuid-10866.md) —
  bot-triaged; PARKED 2026-10-23 via task-hygiene cap (3/3) on maintainer A/B (per-op downgrade vs SPIR-V diagnostic); jkwak-work assigned, silent; operator never answered the 10-20 ping-or-park ask. Wakes on webhook. Coupled to #13518.
- [slang#13518 — MemoryOrder validation](13518-memory-order-validation.md) —
  DRAFT PR #13541 (R2 APPROVE_WITH_NITS) HELD on maintainer Q1/Q2; PARKED 10-26, wakes on webhook. jkwak-work assigned. Coupled to #13519.
- [slang#13591 R-series — contributor standards for AI assistants](13591-authorship-rules-r-series.md) —
  szihs's umbrella + R1–R10 sub-issues (#13592–#13602), self-assigned, each with its own PR. Not dispatched.
- [slang#13631 — `workgroupUniformLoad` synchronizes only on WGSL](13631-workgroup-uniform-load-barrier.md) —
  DRAFT PR #13659 (review cap reached) PARKED on the maintainer semantics call: issue owner jkwak-work (since 10-19), PR reviewer kaizhangNV. The reporter pinged jkwak-work on the PR 11-06. CI approval-gated, no timer. Gaps #13675 + #13683 are owned here (no dispatch on their webhooks).
- [slang#13634 — WGSL BAB `Load<half>` → E56103](13634-wgsl-bab-load-half-int16.md) —
  TERMINAL: closed 10-21 via reporter PR #13647; fixer stood down. Gaps 2/3 (struct `bit_cast` half, any-value half) are unfiled, waiting on the operator.
- [slang#13661 — WGSL BAB `Store<half>` rejected; atomic view?](13661-wgsl-bab-store-half-atomic-view.md) —
  triaged P2; the reporter owns every fix path (#13735, #13852, Metal filing), jkwak-work assigned. Bot hands off; waiting on jkwak-work's reviews. No timer.
- [slang#13654 — Metal `StructuredBuffer<S>` with a `Texture2D` field aborts slangc](13654-metal-structuredbuffer-texture-field-abort.md) —
  DRAFT PR #13681 PARKED, no timer; do not re-ask. Follow-ups #14336/#14337 need no dispatch; a human-filed in-place-lowering follow-up goes to the triager (see record). [Triage/fix/GPU history](13654-history-triage-fix-gpu.md)
- [slang#13643 — WGSL address-space specialization re-clones its own clones](13643-wgsl-address-space-specialization-reclone.md) —
  TERMINAL: reporter PR #13648 MERGED 10-21, issue closed. #12563 must rebase onto it.
- [slang#13721 — `extension N::T` body can't see `N`'s members](13721-extension-namespace-qualified-target-lookup.md) —
  human language-semantics question (skiminki-nv), P2; lookup is lexical-only. PARKED on a maintainer pick of A/A′/B/C; no fixer. Next re-check `t-aaff5f` 10-30.
- [slang#13688 — Metal inline RayQuery fixed tags (no curves / multi-level)](13688-metal-rayquery-curves-multilevel.md) —
  human Metal feature/design question, P3. PARKED on kaizhangNV (assigned, Q4); tracked in supervisor-state. Sibling #13690.
- [slang#14007 (+ #14006) — Metal ParameterBlock combined Sampler2D Load/GetDimensions](14007-metal-parameterblock-combined-sampler-texture-only-ops.md) —
  one fixer chain for both; DRAFT PR #14017 (stacked on #13741 — never push to #13741) PARKED on falcor-ci + ready flip + #14042-fold (operator, unanswered since 10-29); jkwak-work self-assigned the issues 11-02. Owns #14041/#14042 (no dispatch). One-shot 11-12.
  - [Dated history](14007-metal-parameterblock-history.md)
- [slang#13737 — HLSL combined-sampler `Load`/`GetDimensions` extra sampler arg](13737-hlsl-combined-sampler-texture-only-ops.md) —
  DRAFT PR #13741 R4 APPROVE; CI waits on `falcor-ci`, ready flip = operator. Owns follow-ups #14123–#14126 + #14041 (no dispatch on their webhooks). Re-check 11-14 (11-07: no change).
  - [Dated history](13737-hlsl-combined-sampler-history.md)
- [slang#13766 — WGSL pack_clamp_u8(int4) negative lane → 255](13766-wgsl-pack-clamp-u8-negative-lane.md) —
  **CLOSED 10-22** by reporter PR #13775. Operator item: whether to file the D3DCOLORtoUBYTE4 WGSL finding.
- [slang#13739 — WGSL/Metal BAB Load<T> keeps dead word loads](13739-wgsl-metal-bab-struct-load-dead-word-loads.md) —
  fix A via reporter PR #13764 (triager-verified); waiting on maintainer CI approval + review; no fixer. Spin-wait side note unfiled (operator).
- [slang#13768 — WGSL tier1/tier2 storage-texture formats + E56106](13768-wgsl-storage-texture-tier1-tier2-formats.md) —
  part 1 = DRAFT PR #13778 (R1 AWN applied), HELD in draft (operator never answered the ready flip). Part 2 (E56106 B1–B4) parked on zangold-nv/expipiplus1. 11-06 the reporter pinged zangold-nv/expipiplus1 on #13778. Final re-check: triager one-shot `i13768-recheck-1120-3d42` 11-20 13:00Z.
- [slang#13732 — WGSL member subscript copies whole uniform struct](13732-wgsl-uniform-member-subscript-whole-struct-copy.md) —
  human WGSL perf regression, P2; fix = reporter PR #13734 (no fixer). PARKED on jkwak-work review; re-check `rechase-13732-pr13734-cb-aa7d` 11-08 15:00Z. storeCoherent side find unfiled; operator asked twice (10-29, 11-05), do not re-ask.
- [slang#13690 — Metal RayQuery → `intersector<>` lowering?](13690-metal-rayquery-intersector.md) —
  human Metal design question, Feature/P3. PARKED on kaizhangNV (assigned 10-19, milestone Q1 2027); no fixer. 11-06 re-check unchanged; next `t-2046b6` 11-20. Sibling #13688.
- [slang#13642 — slang-wasm `createSession` macros/search paths/options](13642-slang-wasm-createsession-options.md) —
  **TERMINAL, closed 10-23.** Reporter's PR #13651 (C++-shaped `SessionDesc` with `targets[]`, per jkwak-work) was merged by jkwak-work as d36f0be181.
- [slang#13662 — slang-wasm `loadModuleFromIRBlob` + `Module.serialize`](13662-slang-wasm-load-module-ir-blob.md) —
  **TERMINAL, closed 10-31.** Reporter PR #13663 merged by jkwak-work (c959b561); held issue post moot. Older dup #8744 still OPEN (maintainer to close).
- [slang#13673 — `sign` in `slang.numerics` (`ISignedNumeric.IntegerSign`)](13673-numerics-sign-requirement.md) —
  tangent-vector feature proposal, self-assigned. TRIAGED 10-16 (cmt 6210602589), P2; PARKED on tangent-vector, fixer HELD (design-RFC). Prereq: int-matrix conformances; CoopVec lacks core `sign`. Triager re-check t-6d276c 10-23.
- [slang#13676 — SPIR-V `float(sign(x))` redundant FToS→SToF round-trip](13676-spirv-sign-float-int-float-roundtrip.md) —
  P3, human-owned (tangent-vector self-assigned 10-21, GoodFirstBug). 11-05 final re-check `t-aea473`: no change, no timers left. GLSL `sign(x)/2` side bug filed as #14356.
- [CMake Options red: monolithic std-module lib + portable raytracing install (11-07)](cmake-options-monolithic-portable-install-2026-11.md) — filed #14400 11-07; FILED-ONLY. issue_opened needs NO dispatch. Fix PR #14417 (jkwak-work, 11-09) queued for the paused approver.
- [slang#14382 — GLSL / c-like IntPtr still write INT64_MIN out of range (`case INT64_MIN:` fails glslang, dxc)](14155-int64-min-literal-emit.md) — bot-filed 11-06 as the #14155 follow-up; FILED-ONLY. issue_opened needs NO dispatch.
- [slang#14380 — default argument lowered in the caller's context (wrong `this` / segfault / E99997)](14380-default-arg-caller-context.md) — bot-filed 11-06 from the #13674 side findings; FILED-ONLY (fix waits on #13674 design); (c) dup of #10150. issue_opened needs NO dispatch.
- [slang#14356 — GLSL input `sign()` returns int, `sign(x)/2` integer-divides](14356-glsl-sign-returns-int.md) —
  bot-filed 11-05 (side finding of #13676). HELD, maintainer-owned: jkwak-work self-assigned 11-06. jhelferty-nv design note 11-11 (separate HLSL/GLSL `sign`). Operator fixer ask retired.
- [slang#13664 — `getBuiltinModuleSource` null-deref without embedded source](13664-getbuiltinmodulesource-null-without-embedded-source.md) —
  TERMINAL: reporter PR #13665 merged 10-26, issue closed. Follow-up B (empty-source compile) and the language-server note are unfiled (operator call).
- [slang#13635 cluster — WGSL NaN/Inf const-expressions Tint rejects](13635-wgsl-nonfinite-const-expr-cluster.md) —
  reporter PR #13645 rejected. Bot drafts #13816 (on #13669), #13670 (HOLD), #13669, #13680 await operator un-draft; #13671, #13682 parked; doc-regen #13821.
- [slang#13639 — WGSL push constants as `var<immediate>`](13639-wgsl-push-constant-immediate.md) —
  fixed by reporter PR #13646 (MERGED 10-21), issue closed. Only open item: operator go/leave-it on the stale-line edit in cmt 6193417129; no re-arm. Follow-on #13666 → slang-triager; side segfault #13656 filed, unrouted.
- [slang#13640 — WGSL `diagnostic(...)` directive emission](13640-wgsl-diagnostic-directive.md) —
  human feature request, P2 (rec A: a compiler option). DECLINED 11-06 by jkwak-work ("Unplanned"), so the chain is terminal for us; reporter PR #13660 is still open. Side bugs #14244 (`-Xtint` dropped) + #14245 (`-Xglslang` dropped) filed 11-03, filed-only; both self-assigned by jkwak-work 11-04 (Q1 2027), held (rung 4).
- [slang#13617 — WGSL fragment `SV_PrimitiveID`](13617-wgsl-fragment-primitive-id.md) —
  human feature request (rhendry), P2; DRAFT PR #13619 (Approach A), jkwak-work assigned. PARKED on maintainer + ready-flip (weekly list); subgroups side note filed as #14383 11-06 (jkwak-work self-assigned). PARKED webhook-only, no timer, 11-08 ('unpark 13617' reopens). [Re-chase log](13617-wgsl-fragment-primitive-id-rechase-log.md).
- [slang#13590 — WGSL emits `bool` members in `var<uniform>` structs](13590-wgsl-bool-uniform-host-shareable.md) —
  human-filed (j8asic) WGSL bool not lowered to int in host-shareable address spaces; P2. DRAFT PR #13607 (R1 APPROVE_WITH_NITS applied). **PARKED** 10-16 in the parked-chain register on kaizhangNV/jkwak-work review + CI approval. 2 follow-ups unfiled (operator).
- [slang#13571 — WGSL matrix negation emitted as `matNxM<f32>(0) - m`](13571-wgsl-matrix-negation.md) —
  human WGSL emit bug, P2; draft PR #13572 @5be2d78f1b (#14179 fold-in kept local; HELD 11-05, jkwak-work self-assigned #14179) awaits jkwak-work. Follow-ups #14184–#14188 belong to this chain (no dispatch); #14184 claimed by a human. Detail in the record.
  - [Dated history](13571-wgsl-matrix-negation-history.md)
- [slang#14179 — WGSL vector negation loses -0.0](14179-wgsl-vector-negation-signed-zero.md) —
  human WGSL emit bug, P2, triaged 11-02. HELD 11-05 (jkwak-work self-assigned): fold-in commit local, one-shots cancelled, resume on ask.
- [slang#13558 — SlangPy ARM64 segfault draining the current-device stack](13558-slangpy-arm64-current-device-stack-segfault.md) —
  **TERMINAL, closed 10-12.** jkwak fixed it in slangpy#1219 (`~Device()` erases its stack entries, merged as fb1bca1). The 10-14 post-fix nightly ASan passes test_push_pop_current_device; the remaining red is unrelated.
- [slang-rhi#876 — in-flight command buffers retain the device](slang-rhi-876-inflight-cmdbuf-device-retention.md) —
  external lifetime-cycle bug, fixed by maintainer PR #884 (MERGED 10-01, no closing ref). #880 CLOSED as superseded 10-27. Triager asked 10-28 for a FINAL suggesting a close; re-check `rechase-slang-rhi-876-fi-0ff5` (11-11).

- [slang#12609 — bulk-copy dyn-interface packing, PR #12875](12609-bulkcopy-dyn-interface-packing.md) —
  **PARKED 10-24** after 6 silent re-chases (task-hygiene register; no re-arm). Still waiting on maintainer jvepsalainen-nv (re-review + Windows-run question). The head has no CI since the Actions purge and is 120 behind; the operator can resume with `go 12875 rebase|ping`.

- [slang#13107 — static const struct arrays rebuilt per invocation](13107-cuda-static-const-struct-array.md) —
  external P2, **closed on our side 11-02**. #13115 was closed in favor of jkwak-work's #14204. We confirmed #14204 carries the CUDA vector/matrix/`half` struct-table regression and posted a repro note there (comment 6590344457), offering our `a6d49136b` patch. No timer.
  - [Dated history](13107-history-triage-to-close.md)

- [slang#14238 — `[ForceInline]` int `/`/`%` helper in a global const array no longer folds](14238-int-div-forceinline-global-const-regression.md) —
  bot-filed 11-03 from #14133 (its `issue_opened` needs no dispatch). Draft PR #14267 (Fixes #14238 + #14217): R3 APPROVE 11-05, ready-flip pending (asked once). Owns #14278-80/#14321/#14330.
  - [Dated history](14238-history-triage-to-ready.md)
- [slang#14330 — CUDA vector arithmetic in a global `static const` gives a ptx dynamic init](14330-cuda-vector-arith-static-const-dynamic-init.md) — bot-filed 11-05 from the #14238 chain (its `issue_opened` was not dispatched). **11-06 18:26Z jkwak-work asked @nv-slang-bot to triage and self-assigned**: triage-only chain on `gh-issue-shader-slang/slang-14330`, no fixer chain until they say so.
- [slang#14321 — `-g` E99997 for a struct `static const` passing a uniform to `[ForceInline]`](14321-g-e99997-struct-static-uniform-forceinline.md) —
  bot-filed 11-04, split from #14267 (commit 2). Not a regression. **Its `issue_opened` belongs to the #14238 chain, so do not dispatch it.** Fixer chain on its own thread; open question is E31226 vs. no debug-inst cloning.
- [slang#14278 — WGSL `static const` from a spec constant hangs slangc](14278-wgsl-static-const-spec-constant-hang.md) —
  bot-filed 11-03 23:26Z, #14267 side find. **Its `issue_opened` belongs to the #14238 chain, so do not dispatch it.** Re-triaged 23:54Z: **P1 regression since v2026.7**; fixer chain on `gh-issue-shader-slang/slang-14278`; 11-04 01:10Z draft PR **#14285**; 03:2xZ review complete, ONE ready-flip ask sent (no re-ask).
- [slang#14279 — SPIR-V `OpConstantComposite` with spec-constant operands](14279-spirv-constantcomposite-spec-constant-operands.md) —
  bot-filed 11-03 23:26Z, #14267 side find. **Its `issue_opened` belongs to the #14238 chain, so do not dispatch it.** 11-04 03:2xZ: fixer chain started; 03:33Z re-triaged as a **regression since v2026.7** (ready-flip = direct ask); 04:28Z draft PR **#14293**; 05:2xZ review complete, ONE ready-flip ask sent (no re-ask).
- [slang#14280 — `-g` + `[noinline]` scalar `static const` dynamic init](14280-g-noinline-scalar-static-const-dynamic-init.md) —
  bot-filed 11-03 23:26Z, #14267 side find. **Its `issue_opened` belongs to the #14238 chain, so do not dispatch it.** Held filed-only (P3).
- [slang#14321 — `-g` ICE E99997 from debug insts cloned into module scope](14321-g-debug-clone-module-scope-uniform-ice.md) —
  bot-filed 11-04 20:23Z, split-out commit 2 of #14267, not a regression. **Its `issue_opened` belongs to the #14238 chain, so do not dispatch it.** The #14238 triager starts the fixer chain on `gh-issue-shader-slang/slang-14321`.
- [slang#14290 — E31226 false positive, spec constant in a `static const` array](14290-e31226-spec-constant-array-static-const-false-positive.md) —
  bot-filed 11-04 03:19Z, #14285 side find, regression since v2026.9. **Its `issue_opened` belongs to the #14278 chain, so do not dispatch it.** 11-04 04:2xZ handed to slang-fixer; 05:43Z draft PR **#14300**; 08:1xZ review complete, **held as a draft until #14293 merges** (then lanes + one direct ask).
- [slang#14378 — E31226 for a `static const` global initialized from a resource parameter](14378-e31226-static-const-resource-initializer.md) —
  **P1 regression** from #10925. Reporter PR #14379 open (must-fix segfault found 11-07; fork CI awaits approval). Follow-up #14399 belongs to this chain, no dispatch.
- [slang#14291 — GLSL member `static const` array of spec-constant exprs](14291-glsl-member-static-const-array-spec-constant-init.md) —
  bot-filed 11-04 03:35Z, #14279 side find, not a regression. **Its `issue_opened` belongs to the #14279 chain, so do not dispatch it.** Held filed-only (P3).
- [slang#14301 — spec-constant attribute on `groupshared` silently dropped](14301-groupshared-spec-constant-attribute-dropped.md) —
  bot-filed 11-04, #14300 side find, not a regression. **Its `issue_opened` belongs to the #14290 chain, so do not dispatch it.** Held filed-only (P3).
- [slang#14133 — CUDA `[ForceInline]` `__init` global constant emitted at file scope](14133-cuda-static-const-forceinline-init-file-scope.md) —
  human-filed (albertrodriguezclo) 11-01, P2 on all targets. Reporter PR #14150 has 2 regressions vs master (triager watches, t-700e05); fixer holds a local branch. Side find **#14217** belongs to this chain (no dispatch). Detail in the record.
- [slang#13108 — CUDA by-value struct copies an unread array](13108-cuda-byvalue-struct-copy.md) —
  **TERMINAL for the bot 10-14**: jkwak-work deprioritized it; minco3's draft #13583 is the maintainers' call. No further re-checks.

- [slang#13169 — bwd_diff runtime-bound loop hang](13169-bwd-diff-runtime-loop-hang.md) —
  **CLOSED 2026-10-09** by saipraveenb25 (fixed by #13234). slangpy#1167: CUDA check passed 10-16; regression-test PR slangpy#1225 (draft) awaits its round-2 reviewer verdict. The bundled #13301 tail is now its own record (next row).
- [slang#13301 — header guard #13742 / slangpy#1204](13301-header-guard-slangpy-1204.md) — #13742 MERGED 10-22 (`653bfdeef`); slangpy#1206 waits on the operator's A/B/C and the slangpy pin bump (v2026.21 ships the fix). Silent re-check `rechase-slangpy-1204-pin-aaa4` (11-11 10:30Z).

- [slang#13555 — `-ignore-capabilities` + case-less `__target_switch` → silent UB](13555-ignore-capabilities-caseless-target-switch.md) —
  draft PR #13564 PARKED on maintainers (breaking? cpp case; #13555 assignee jkwak-work) + ready-flip pending (weekly list). 11-05: merged master, head a4e7e33342 at 913 / v38-39, MERGEABLE; flips 3 #14269 lanes E41009→E41037 by design. ⚠ shares v39 with #13425. Re-chase `rechase-13564-merge-913-9c85` 11-12.

- [slang#13556 — CUDA/PTX `SampleGrad` via `tex*Grad`](13556-cuda-samplegrad.md) —
  **MERGED 2026-10-15** (#13559, combined-sampler only; separate-sampler stays E36107 per jkwak-work). Possible unfiled follow-up: separate-sampler `Sample`/`SampleLevel` on CUDA.
- [slang#13544 — C++14 `'` digit separators](13544-digit-separators.md) —
  CLOSED 10-13 (completed). Drafts #13547 (float `_`, blocked by skiminki-nv) and #13546 (`#if`, `Fixes #13545`) still live; CI waits on falcor-ci. PARKED on an inbound; no further re-chase.
  - [#13544 triage, drafts, maintainer rounds and close (history)](13544-history-triage-to-close.md)

- [slangpy#1214: SlangPy Tests red on every Slang PR since slangpy#1199](slangpy-1214-cuda-cap-ci-latest-slang.md) —
  **an outage of a required check that blocks all Slang merges.** The one-line fix is in slangpy `ci-latest-slang.yml` and belongs to the maintainers. Escalated to the operator 10-08.

- [slang#13536 — add `RTexture*`, warn on `readonly`/`writeonly` on `RWTexture*`](13536-rtexture-deprecate-readonly-rwtexture.md) —
  maintainer feature (step 1 of 2), P2. Fixer HELD on the author's HLSL choice (reject vs lower with loss); still silent at the latest re-chase; next `rechase-13536-hlsl-choic-eeda` 11-15.

- [nanoclaw PR: expired falcor gate → `gate_expired`](ci-babysitter-gate-expired-pr.md) — **PARKED 10-19, no PR.** The babysitter's two sweep-gate fixes are durable patches in `data/patches/`, never pushed; the operator never answered (asked 10-16, 10-17). Resume only on an operator "open it".
- [Yield-retry bot starved by `waiting` runs](ci-retry-yielded-bot-starved-by-waiting-runs.md) — `retry-yielded-bot-ci.py` counts approval-parked `waiting` runs as active, so it never retries yielded bot CI. Maintainer decision; raised with the operator 10-12, still live 10-21 (#13201 gate expiry).
- [Falcor bridge rerun policy](falcor-bridge-rerun-policy.md) — gate 0d split: bridge `relay error` gets one `--job` rerun; pipeline `failed` gets none (two in a row = PR-owned, #13697). The #13880 one-off was for #13725-window reds. A rerun needs the live `slang-tests-*` artifact, or else a rerun of the falcor build job.
- [Actions queue stall 10-17](actions-queue-stall-2026-10-17.md) — **recurring Saturday ~08:00Z** stall; likely the weekly `cmake-options.yml` matrix (inference). A fix needs a maintainer.
- [Actions run history gap 10-01→10-07](actions-run-history-gap-2026-10-01-07.md) — oldest-first deletion of workflow runs from 10-01 20:05Z, resumed by 10-16; cause unknown, with the operator. PRs with heads in the window look like `no-ci`.

- [slang#13515 — LLVM prebuilt key change after #13139 (cold builds, 120-min cancels)](13515-windows-aarch64-llvm-prebuilt.md) —
  **TERMINAL 10-12**: #13526 merged, prebuilts live; 8 human fork PRs need a master merge from their authors.

- [slang#9078 — GLSL→Metal global varying layout-key crash](9078-glsl-metal-global-layout-key.md) —
  draft PR #13467 (Partial), reviewer REQUEST_CHANGES (CPU/CUDA globals mis-offset). Held on jhelferty-nv's a/b/c (reviewer: a). Next re-chase `rechase-9078-jhelferty-602a` (10-15).

- [slang#13220 — CUDA interface dispatch unreachable default, draft PR #13228](13220-cuda-dispatch-unreachable-default.md) —
  held draft `842ea5d5c1`, no CI signal yet (Falcor gate expired). Waiting on kaizhangNV's undefined/trap/return answer (silent since 10-05) and the operator's a/b/c.
  Webhook-driven, plus passive one-shot `passive-13228-d25-43d6` (2026-10-30).

- [slang#13259 + #12934 — typeflow refined-info re-wrap ICE, PR #12935](13259-typeflow-refined-info-rewrap.md) —
  **MERGED 2026-10-05** (`e6be8dcdd7`). The producer fix in `makeInfoForConcreteType` replaced a disproven consumer `none()` fix. Holds the overclaim timeline and lessons.

- [slang#13436 — DownstreamArgs lost across option levels (linkWithOptions / addTarget)](13436-downstream-args-cross-level.md) —
  **CLOSED 10-12**: PR #13450 merged by kaizhangNV (e4d92bf0bb), issue auto-closed. Side finding held, unfiled (explicit operator A only).

- [slang#12627 — CUDA masked RWTexture store, draft PR #13363](12627-cuda-masked-rwtexture-store.md) —
  PARKED on jkwak-work's coherency answer (RMW+warning vs CUDA error). Draft; no re-chase, the supervisor tick watches it. Follow-ups #13361/#13362/#13364/#13365 not dispatched.

- [slang#13554 — CUDA layered `_convert` surface write is an empty stub](13554-cuda-layered-convert-write-stub.md) —
  **TERMINAL 2026-10-15**: PR #13563 was merged by jkwak-work (`788be3144e`), and the issue closed COMPLETED. GPU CI proved `sust.p.a{1d,2d}` on hardware.
  The stale #13363 rule is followed up by the #12627 chain.

- [slang#13428 — local multi-declarator `j < 2` → E30015 (parser declarator registration)](13428-local-multi-declarator-generic-lookahead.md) —
  #13428 TERMINAL (PR #13432 merged 10-07). Sibling #13430's draft PR #13434 PARKED 11-04, no timer (reopen on "un-draft 13434" / "unpark 13434" or a human comment/review). Side findings #13433/#13435 have their own gates.
  - [Decision trail 10-04 → 10-08](13428-13430-decision-trail.md)

- [slang#13488: `try` on a non-throwing ctor/subscript not diagnosed](13488-try-non-throwing-ctor-subscript.md) -
  **TERMINAL 2026-10-09.** PR #13503 merged 16:29Z (`08d419cbf2`) and #13488 auto-closed. Follow-up #13508 has its own record (below).
- [slang#13508: `[Differentiable]` + `throws` → E38105 ×3 / E99997](13508-differentiable-throws-e38105.md) -
  parked on saipraveenb25 (2 scope questions + a PR go-ahead on the E38038 proposal); silent through 3 re-chases, operator told 10-26, no task. #11709 also takes E38038.
- [slang#13489: accessor errors + throwing call nested in `try`](13489-accessor-errors-nested-try.md) -
  **TERMINAL 2026-10-16.** #13502 merged 10-09, and #13514 merged 10-16 10:04Z after its in-place try-coverage fix cleared the Windows-Debug stack overflow; the issue auto-closed.
- [slang#13491: one `try` covers every throwing call in its operand](13491-try-covers-nested-calls.md) -
  design-gated feature, **PARKED** on maintainers (coverage model + nested-`try` policy). Re-chase `rechase-13491-try-covera-6544` (11-04).
- [slang#13490: `try` in a lambda checked against the enclosing function](13490-lambda-try-error-context.md) -
  triaged P2 bug. **HOLD**: no fixer until skiminki-nv asks for a PR. No timer; resumes only on a human comment or an operator GO/DROP.

- [slang#13495: HLSL `class` as a value type (`HLSLClassDecl : StructDecl`)](13495-hlsl-class-value-type.md) -
  **TERMINAL 10-08**: fixed by tangent-vector's own PR #13497. Sibling #13496 has its own Main session.

- [slang#13509: enclosing `==` constraint not applied to a substituted nested assoc type](13509-generic-member-equality-nested-assoc.md) -
  fixer HELD until assignee kaizhangNV asks (fix A prototyped, reverted). No timers or asks; only a webhook or an operator GO/DROP resumes it.

- [slang#13463 — Zed: slangd null config reply disables workspace include search](13463-zed-slangd-null-config.md) —
  **MERGED 2026-10-12** (PR #13475, `fac7213eba`; the assignee jkiviluoto-nv adopted the bot PR, verified it in real Zed, and merged it). Terminal record + lessons.

- [slang#13424 — loops with a constant trip count are not folded at -O3](13424-loop-constant-folding.md) —
  P3, assigned jkwak-work. Option A ask budget exhausted → HOLD; B/C/D need maintainer design; SPIRV-Tools#6930 merged upstream, not yet in the submodule. Webhook-driven only.

- [slang#13704 — WGSL forced scalar layout on entry-point uniforms](13704-wgsl-forced-scalar-entry-point-uniforms.md) —
  **TERMINAL** — reporter PR #13706 (option A, ignore the flag on WGSL) MERGED 10-23 00:10Z (340047a3ce); issue closed. Operator: file the 2 adjacent layout bugs?
- [slang#13391 + #8323 — WGSL-via-Tint std140 layout, draft PR #13402](13391-wgsl-tint-std140.md) —
  **PARKED 11-09, no timer** (re-ask cap; 11 operator asks unanswered). Our gates have passed (review r2 APPROVE_WITH_NITS); only un-drafting (B) gets around the bot-dispatch throttle. Webhook-only: resumes on a B / "unpark 13402" reply, a human comment, a new head or run, #13478 landing, or #13935 merging.
  - [Dated re-chase log](13391-wgsl-tint-std140-rechase-log.md)

- [slang#13298 — GCP-T4 runner dies mid-test in release-gpu-dx (pagefile)](13298-gcp-t4-runner-loss-pagefile.md) —
  CLOSED 10-22 by maintainer; 32 GiB pagefile fix held (0 recurrences post-rollout). Terminal record.
- [slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout](13423-metal-cb-scalar-layout.md) —
  draft PR #13425 (r2 AWN) parked on a maintainer review / un-draft; #13386 lands first. Its stable id keeps colliding with master (collision 7, 11-11: merging 914 / min 41 / max 42, verify 13:00Z).
  - [re-chase log](13423-metal-cb-scalar-layout-rechase-log.md) · [sealed 10-04 → 11-02](13423-metal-cb-scalar-layout-rechase-log-2026-10.md)

- [slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum](13419-extern-enum-conditional-binding.md) —
  NO-GO for the bot (the reporter is the assignee). Assignee PR #13487 is open: 1 Falcor CI failure, 5 tangent-vector inline comments unanswered. Re-chase `rechase-13419-pr13487-5716` (10-28).

- [slang#13420 — false-positive E41035 for store/read under the same condition (must-init walk is path-insensitive)](13420-uninit-correlated-conditions.md) —
  triaged + reproduced regression (#11293). jhelferty-nv assigned it to the reporter, so NO-GO and the fixer is stood down; on 10-09 the assignee opened PR #13543 (Fixes #13420), which has been open, conflicting with master and idle since 10-16 (as of 11-11); next re-chase `rechase-13420-pr13543-6e20` (2026-11-18).

- [slang#13409 — Metal groupshared forwarded across barriers; sibling #13412 (all-target pointer roots)](13409-metal-groupshared-barrier-forwarding.md) —
  drafts #13421 + #13431 passed internal review; CI never ran. In the parked-chain register since 10-29; no timer.
  - [#13409/#13412 decisions, review rounds and re-chase log](13409-history-decisions-and-rechases.md)

- [slang PR #12136 — lazy autodiff builtins, fork PR approver loop](12136-lazy-autodiff-approver-loop.md) —
  **PARKED, no timer (11-10)** after 9 unanswered operator asks (approver paused + session cost-escalated). Reopens on "continue 12136" or an approver unpause; no re-chase scheduled.

- [slang#13311 / PR #13312 — nightly stale agentic tests, now 3 docs leftovers](13311-nightly-agentic-stale-tests-docs-leftovers.md) —
  superseded by maintainer #13317, then rescoped by a master merge after jkwak-work's approval was dismissed. It is non-draft and mergeable. The operator's (a)/(b)/(c) decision went unanswered for 3 rounds, so on 10-02 it was HANDED OFF to maintainer review. No re-chase is scheduled.

- [slang#13385 — HLSL `Append` of a non-default-layout matrix struct segfaults](13385-hlsl-append-matrix-layout-segfault.md) —
  draft PR #13386 (AWN) has no CI; un-draft is the operator's call. Bare-matrix gap #13388 belongs to jkwak-work, unrouted. **Parked with no timer since 11-02** after the 10th unanswered ask; "un-draft 13386" unparks it.

- [slang#13350 — glsl-module matrix `operator*`/`*=` gated off wgsl+metal (E36107)](13350-glsl-matrix-mul-wgsl-metal-gate.md) —
  ✅ TERMINAL 11-04: PR #13356 merged by jkwak-work (f0660607f1), issue closed COMPLETED. Follow-ups #13355 + #13359 HOLD on jkwak-work.
  Re-chase `rechase-13355-13359-r9-59a2` (2026-11-14, #13355 + #13359 only; r8 11-07 no change); dated entries in [re-chase log](13350-glsl-matrix-mul-rechase-log.md).
- [slang#13041 — verify-documented-compiler-version.sh exit 4 (windows-aarch64); bot fix #13042 incomplete](13041-verify-compiler-version-exit4.md) —
  three post-fix hits (two in merge_group, 09-28/29, plus #11709 on 09-30). Diagnostic draft #13352 is waiting on the operator ready-flip and on jvepsalainen-nv choosing exit semantics; re-chase `rechase-13352-exit-seman-440c` (10-03).

- [slang PR #11709 — groupshared parameters by reference](11709-groupshared-param-by-reference.md) —
  **TERMINAL — MERGED 11-11 (`6862c98ecc`)** by jhelferty-nv after her own rework; the bot stands down (incl. her #14094; bot-filed #14105 needs no dispatch). #13406 rounds: [11709-13406-ref-split-review-rounds.md](11709-13406-ref-split-review-rounds.md).

- [slang#13348 — inherited field through a property/subscript BoundStorage → E99997 ICE](13348-inherited-field-boundstorage-ice.md) —
  triaged + reproduced; three BoundMember consumers accept VarDecl only and reject InheritanceDecl. The author
  self-assigned it, so NO-GO and no fixer; silent at the 10-07, 10-14, 10-21, 10-28, 11-04 and 11-11 re-chases; next `rechase-13348-assignee-9551` (2026-11-18).

- [slang#13346 — note-suppression tracking issue for maintainer PR #13325](13346-note-suppression-tracking.md) —
  TERMINAL. #13325 merged 2026-09-30 and the maintainer closed #13346 by hand on 2026-10-01; the re-chase is done.

- [slang#13337 — stray `;` in an interface → E38100 empty-named member](13337-interface-emptydecl-requirement.md) —
  **CLOSED 2026-10-02.** The author's PR #13367 merged, implementing the triaged Approach A (skip `EmptyDecl` in
  the `checkInterfaceConformance` requirement loop). Terminal; no fixer was ever dispatched.

- [slang#13336 — `property override` ICE (decl modifier in a type slot)](13336-override-after-property-ice.md) —
  **CLOSED 2026-10-02.** The author's PR #13366 merged, implementing the triaged Approach A (catch-all → E31201
  `ModifierNotAllowed`). Terminal; no fixer was ever dispatched.

- [slang#13332 — second-order crash on a no_diff value; is higher-order supported?](13332-second-order-nodiff-scope.md) —
  fixer `sess-1789716207340-dwbdoz`. jkwak-work says second-order is unsupported, contradicting the user guide; likely decides #13320–#13327. Waiting on the operator's ping-or-hold call.

- [slang#13319 — conflicting link-time exports, order-dependent pick](13319-conflicting-link-time-exports.md) —
  draft PR #13471 (E45002 warning, `pr: non-breaking`) open 2026-10-07; held on kaizhangNV's
  error-vs-warning call + draft-gated CI. Re-chase `rechase-13471-severity-fbf6` (2026-10-14).

- [slang#13330 — array-of-struct shader IO crashes SPIR-V/GLSL](13330-array-of-struct-shader-io.md) —
  triaged; two legalize-pass defects. Main stood down 10-28: external user binaryfire is working on a
  layout-preserving fix. Fixer HELD; PARKED indefinitely 11-03 with no re-checks (webhooks only).

- [slang-rhi#787 — CUDA↔Vulkan shared-texture missing sync](rhi-787-cuda-vulkan-shared-sync.md) —
  PR #881 (`handOffShared`/`takeOverShared`, non-draft, GPU-CI-green @`ec514f4`) parked on jhelferty's R4/R5 answer + skallweitNV's review. Re-chase `rhi-881-review-rechase-4658` 11-04.
  - [PR #881 review-round history (condensed)](rhi-787-review-history.md)
- [slang#13549 — bump pinned LLVM to drop the ARM COFF patch](13549-llvm-pin-coff-patch.md) — OPEN; llvm/llvm-project#229712 merged 10-26 but is in no LLVM release yet (not 23.1.5, 11-06); maintainer-owned (jkwak-work); one-shot re-chase `rechase-slang-13549-r2-8b4e` 11-20 09:00Z
- [slang#13565 — SemanticChecking compile-time step since 10-07](13565-semcheck-compile-perf-step.md) — OPEN, maintainer-owned (jvepsalainen-nv), silent; re-measure from absolute daily medians. Re-chase `rechase-13565-r5-a966`.

- [slang#13793 — member typealias caps don't reach enclosing struct](13793-member-typealias-capability-propagation.md) —
  TERMINAL: superseded by kaizhangNV's PR #13798; design question held with tangent-vector/skiminki-nv. Lesson: check the timeline for a reporter PR before dispatching a fixer.
- [slang#13387 — whole-helper specialization per conformance](13387-helper-per-conformance.md) —
  fork PR by jvepsalainen-nv; 10-24 saipraveenb25 asked the bot for an extension-based rework. The fixer's proposal is on slang-coworkers fix/issue-13387 (8c5bb99, 11 commits). Parked on Q1–Q5 to saipraveenb25; re-check task slang-13387-maintainer-r-c5d6 runs 10-27.
- [slang#14038 — `a -= b` not synthesized from user `operator-`](14038-compound-assignment-from-binary-operator.md) — human-filed 10-29; feature/P3, rec A (diagnostic note); option-A PR #14246 MERGED 11-06 (squash 442487688; last head commit d959f7318 qualifier did NOT land); tangent-vector rejects synthesis, points to IAdditive; issue OPEN, report-only; next one-shot t-737169 11-16 17:15Z
- [slang#14033 — `-target cuh` host header](14033-target-cuh-host-header.md) — draft PR #14197 (A) ready-flip on weekly list; reporter asked for a maintainer decision on B/C 11-06; operator opt-in ping offered (dashboard 51); one-shot chase-14033-bc-maintaine-2e3c 11-13
- [slang#14200 — body-less `__extern_cpp` entry point ICE](14200-bodyless-extern-cpp-entry.md) — draft PR #14202 Fix Report 11-03 (head 32859719b), parked on operator ready flip; G2 = #14213 (filed-only)
- [slangpy#1250 — pyright/nodeenv breaks ci-latest-slang](slangpy-1250-pyright-nodeenv-alpha-index.md) — bot-filed 10-30; "SlangPy Tests" red on every Slang PR since 10-29 22:13Z (infra, not PR); **CLOSED 10-30 13:49Z** by maintainer PR slangpy#1253 (`pyright[nodejs]`); bot #1251 closed unmerged; Slang-side reruns left to babysitter
- [slang#11550 — synthesized-init debug info, merged fix disputed](11550-synthesized-init-debug-info-dispute.md) — bot PR #11555 merged 06-26, later disputed; triager filed FlagArtificial tracker **#14107** 10-30; terminal for the bot. #14107 assigned to kaizhangNV; pdeayton-nv PR **#14344** (reverses #11555, breaking) queued for the paused approver.
- [slang#14100 — float3→float user implicit conversion builds `vector<vector<float,3>,4>`](14100-implicit-conversion-nested-vector.md) — human-filed 10-30, regression since #6408; **CLOSED 11-05** — PR #14110 merged as 7cda6d343 by tangent-vector; follow-ups #14109/#14116/#14117 (owned here, no dispatch)
- [slang#14099 — HLSL sibling `for (int i…)` loops conflict](slang-14099-hlsl-sibling-for-loop-redecl.md) —
  🔚 **Terminal for the bot:** PR #14115 closed unmerged 11-05; maintainer PR #14360 (tangent-vector) supersedes it. No timer.
- [slang#14118 — unbraced if/else/while/do body local visible before its declaration](slang-14118-unbraced-body-local-visible-early.md) —
  bot-filed follow-up of #14099, **owned by that chain** (no dispatch on its issue_opened). Medium/P2; draft PR #14119 R2 APPROVE_WITH_NITS. ⛔ **BLOCKED 11-03 by skiminki-nv** on the #12266 maintainer discussion. Competing maintainer PR #12389 (approach C, breaking) says Fixes #14118. #14119 parked; un-draft ask withdrawn.
- [slang#14120 — locals visible before declaration in `__target_switch` case / unbraced `catch` / unbraced `$for` body](slang-14120-target-switch-catch-for-local-visible-early.md) —
  bot-filed follow-up #2 of #14099, **owned by that chain** (no dispatch). P3; parked until #14119 lands or a maintainer picks; final re-check `recheck-14115-ready-2-3f50` 11-05 17:00Z.
- [slang-rhi#961 — Metal/CUDA dispatch-time thread-group size + `dispatchThreads`](slang-rhi-961-dispatch-time-threadgroup-size.md) — feature/P2, HELD: maintainer-owned (jkwak-work, Q4 2026), no bot post, no timer. Owns bot #14143 (no dispatch).
- [slang-rhi#962 — Metal timestamp queries not implemented](slang-rhi-962-metal-timestamp-queries.md) — human feature request 11-01; feature/medium/P2. **Reporter draft PR #963** implements it; skallweitNV wants a Metal 4-only design. **Maintainer-owned since 11-02** (jkwak-work, Q4 2026): held, no bot post, no fixer, no timer (t-497cc3 cancelled 11-05).
- [slang-rhi#964 — Metal compute pass costs 16-30 us (per-encoder queue-fence wait/update)](slang-rhi-964-metal-compute-pass-fence-cost.md) — human perf report 11-01; P2, after reporter PR #963. **Maintainer-owned since 11-02** (jkwak-work, Q4 2026): held, no bot post; draft posts only on a mention or operator go.
- [slang-rhi#943 — `[SpecializationConstant]` reads 0 instead of its default on D3D11/D3D12/CUDA/CPU](rhi-943-specialization-constant-default.md) — confirmed bug, parked on a maintainer direction pick (assignee jkwak-work since 10-26; #942 merged 10-29 with tests limited to Vulkan/Metal/WGPU). No fixer dispatch; triager one-shot t-57a078 11-15 13:00Z (11-08 re-check: unchanged)
- [slang#14135 — CUDA `__launch_bounds__` / `__maxnreg__` attribute](slang-14135-cuda-launch-bounds-maxnreg.md) — human feature request 11-01, triaged medium/P2. **CLOSED on our side 11-05:** owned by the reporter's PR #14149 (`Fixes #14135`). No bot comment on the human PR. The spin-off (master surplus-attribute-arg assert) was filed as [#14349](slang-14349-surplus-attribute-args-unchecked.md). (The 11-01 R6 hold was the retired rule.)
- [slang#14137 — unknown `-entry` name prints an empty E30015 before E38000](14137-entry-unknown-name-empty-e30015.md) — human bug 11-01, Bug/low/P3. **Deferred 11-02 to reporter PR #14147**; D2/B1 split to #14193. R6 one-shot ran 11-05 14:36Z (no post/fixer); #14147 open, awaiting human review; the supervisor register walks it. A close-unmerged comes back to Main.
- [slang#14138 — CUDA no-alias (`__restrict__`) pointer spelling](14138-cuda-restrict-pointer.md) —
  human feature request 11-01, P2. HELD (rung 4): jkwak-work self-assigned, Q4; the reporter will implement, so no bot fixer. Re-check `r6-release-14138-c527` 11-12 14:00Z. Owns bot #14139 (maintainer-held, Q1 2027).
- [slang#14141 — Metal read-only pointers always `T device*` (want `constant`)](14141-metal-readonly-pointer-constant-address-space.md) — human feature request 11-01; feature/P2, rec B (opt-in `AddressSpace.Constant`), reporter offered the PR. HELD (rung 4): jkwak-work self-assigned, Q4 milestone; no bot post or fixer. Owns bot #14142 (no dispatch).
- [slang#14144 — CUDA `ImmutablePtr` pointer-typed loads skip `__ldg`](14144-cuda-immutable-ptr-pointer-ldg.md) — human perf report 11-01; enhancement/low/P3, rec A. HELD: jkwak-work self-assigned #14144/#14145/#14146 on 11-02 (Q4 milestone), so no bot post. The R6 timer was cancelled 11-05. Owns bot #14145, #14146 (no dispatch).
- [slang#14159 — Metal BFloat16/FP8 emit undeclared `*Type` names](14159-metal-bfloat16-fp8-undeclared-types.md) — human bug (albertrodriguezclo) 11-02. Triaged Bug/medium/P2 (`cuda_sm_*` [require] aliases are cross-target). Triage comment 6648117016 posted 11-05 02:34Z. PARKED on maintainer (jkwak-work): BFloat16-on-Metal + HLSL SM 6.10 FP8 coop-mat; reporter owns the PR, no bot fixer.
- [slang#14158 — Metal `half` NaN/Inf literal emitted as float `(1.0 / 0.0)`](14158-metal-half-nonfinite-literal.md) — human bug (albertrodriguezclo) 11-02; triaged Bug/medium/P2. **Reporter PR #14165** (approach A, non-draft, fork CI awaiting maintainer approval); no bot fixer. Triager re-check t-fce8b1 11-13. Owns bot HLSL twin #14161 (filed-only, no dispatch).
- [slang#14212 — `-incomplete-library -target spirv` segfault on `extern` call inside a loop](14212-spirv-incomplete-library-extern-call-in-loop-crash.md) — human bug, P2; root cause in SPIRV-Tools. Draft PR #14220 awaits human review + ready flip; SPIRV-Tools filing awaits operator. Owns #14223–#14226 (state in record).
- [slang#14215 — proposal: `-validate-with-downstream-compiler` for SIMPLE text-target tests](14215-validate-with-downstream-compiler.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 00:32Z. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14258 — tests: `CHECK-NOT: error NNNNN` lines never match](14258-check-not-old-error-format.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 21:34Z; held until the author's 11-08 @-mention asking for triage → dispatched to slang-triager (is it already fixed by #14269?).
- [slang#14265 — tests: remove dead `*.expected` files (filecheck=/diag=/disabled)](14265-dead-expected-files.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 22:00Z. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14266 — slang-test: `diag=` tests ignore the slangc exit code](14266-diag-tests-exit-code.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 22:03Z. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14292 — slang-test: exit-code check in all test types, not only SIMPLE](14292-slang-test-exit-code-all-test-types.md) — maintainer (jkwak-work) self-filed + self-assigned 11-04 03:42Z, part of #14215 (umbrella over #14266). HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14430 — capability check misses `[require]` of a static member called through a generic type](14430-capability-check-static-member-generic.md) — maintainer (jkwak-work) self-filed + self-assigned 11-10 01:56Z with own root cause/fix attempt. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14431 — `-separate-debug-info` on a non-SPIR-V target should be an error](14431-separate-debug-info-non-spirv-error.md) — maintainer (jkwak-work) self-filed 11-10 02:04Z, CLOSED not_planned 02:08Z: the E00018 warning is by design (#7777 review). TERMINAL; bot never dispatched or posted.
- [slang#14432 — `slangc -E` exits 0 after a preprocessor error](14432-slangc-E-exit-code-on-preprocessor-error.md) — maintainer (jkwak-work) self-filed 11-10 and asked the bot for a PR. **MERGED 11-11 00:36Z** as PR #14438 (9efe5f8ad); issue closed; terminal. Side finds #14439/#14440 filed-only.
- [slang#14439 — `-E -pass-through` writes no output and exits 0](14439-slangc-E-pass-through-exit-code.md) — bot-filed 11-10 by the #14432 triager; FILED-ONLY. 11-11 maintainer (jhelferty-nv, per Tess): the option pair is an error, pass-through is to be removed; assigned jkwak-work — held (rung 4), no dispatch.
- [slang#14440 — `-pass-through glslang -target spirv` gives E99997 "no matching IR symbol"](14440-pass-through-glslang-spirv-e99997.md) — bot-filed 11-10 by the #14432 triager; owned by the #14432 chain, FILED-ONLY (its issue_opened needs NO dispatch). **11-11:** jhelferty-nv asked for an umbrella task (remove pass-through mode, children = pass-through bugs). Relayed to triager `l0dcol`; the umbrella's issue_opened needs no dispatch.
- [slang#14459 — umbrella: remove pass-through mode](14459-remove-pass-through-mode-umbrella.md) — bot-filed 11-11 by triager `l0dcol` on jhelferty-nv's ask; sub-issues #14439/#14440; issue_opened not dispatched; no fixer chain until asked.
- [slang#14249 — GLSL subgroup functions lack HLSL/CUDA impls (shader-subgroup tests disabled)](14249-glsl-subgroup-hlsl-cuda-gap.md) — human bug (jkwak-work, self-filed + self-assigned) 11-03 18:45Z. TRIAGED bug/medium/P2 (cmt 6613400566). PARKED on assignee (11-04: `regression` + Q4 2026 milestone), fixer NO-GO; 11-10 re-check found no activity, no timer.
- [slang#14250 — wrong `subgroupBallotBitExtract` / vector `WavePrefixBitXor` on CUDA; `subgroupInverseBallot` invalid HLSL](14250-subgroup-ballot-bitextract-cuda-hlsl.md) — bot-filed 11-03 19:23Z, split-off of the #14249 triage (sibling #14251). FIXER dispatched 11-03 19:28Z (sess-1793734137589-ke79a8); DRAFT PR #14254 (peer-reviewed, Fix Report 22:07Z), ready-flip pending; side-find #14256.
- [slang#14251 — wave ops on bool: CUDA ElementTypeTrait gap; WaveActiveBit* on bool invalid SPIR-V/HLSL](14251-wave-ops-bool-cuda-spirv-hlsl.md) — bot-filed 11-03 19:23Z, split-off of the #14249 triage (sibling #14250). FIXER dispatched 11-03 19:29Z (sess-1793734151343-ptsuqv); DRAFT PR #14255 (peer-reviewed, Fix Report 23:55Z), ready-flip pending.
- [slang#14261 — WGSL: wave/quad ops on bool emit calls WGSL rejects](14261-wgsl-bool-subgroup-ops.md) — bot-filed 11-03, #14251 follow-up (a). FILED-ONLY: the fix is a maintainer policy choice.
- [slang#14262 — HLSL: WaveActiveBit* on signed ints rejected by DXC](14262-hlsl-waveactivebit-signed-int.md) — bot-filed 11-03, #14251 follow-up (c). FILED-ONLY until #14255 (same HLSL path) merges.
- [slang#14263 — CUDA WaveMatch returns 0 (uses __match_all_sync)](14263-cuda-wavematch-wrong-mask.md) — bot-filed 11-03, #14251 follow-up (d), GPU wrong results. FIXER dispatched 11-03; DRAFT PR #14273 (peer-reviewed, Fix Report 23:48Z), ready-flip pending.
- [slang#14264 — CUDA half WaveActiveAllEqual/WaveMatch fail NVRTC](14264-cuda-half-match-all-sync.md) — bot-filed 11-03, #14251 follow-up (e). FILED-ONLY; offer it to the #14263 fixer once its PR lands.
- [slang#14270 — matrix WaveMask*/WaveActiveAllEqual overloads unavailable on SPIR-V/GLSL](14270-wavemaskprefixbitand-matrix-spirv-glsl.md) — bot-filed 11-03 22:11Z (reviewer side-find on #14254), P3. FILED-ONLY (fixer load 8).
- [slang#14281 — WaveMatch GLSL lacks #extension GL_NV_shader_subgroup_partitioned](14281-wavematch-glsl-missing-extension.md) — bot-filed 11-04, regression since v2024.1.12, P3. FILED-ONLY until #14273 lands.
- [slang#14256 — GLSL `local_size` lost (LocalSize 1) for a non-`[shader]` entry point after module load](14256-glsl-local-size-lost-non-shader-entry-point.md) — bot-filed 11-03, #14250 side-find. DRAFT PR #14275 (peer R2 approve-with-nits), ready-flip pending; side-find #14277.
- [slang#14257 — GLSL matrix `operator*` missing metal in `[require]` (dup of #13350)](14257-glsl-matrix-mul-metal-dup-13350.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 21:29Z. Partial dup of #13350 (draft #13356 widens all 7 gates; the METAL test line also needs #8557 std140). Triager pointer cmt 6616103112, 11-03 21:41Z. Idle on jkwak-work; no fixer, #13356 stays parked.
- [slang#14260 — GLSL texture functions do not all compile for HLSL (intrinsic-texture.slang)](14260-glsl-texture-funcs-hlsl-gap.md) — self-filed + self-assigned by jkwak-work 11-03; TRIAGED P2, idle on assignee, fixer NO-GO. Split-offs #14271/#14272 filed only (state in record).
- [slang#14259 — HLSL constant `double` `RWByteAddressBuffer.Store` emits untyped `.Store(`](14259-hlsl-byte-address-store-double-untyped.md) — human 11-03. **CLOSED fixed 11-11** (#14322 + #14416 merged). Remaining: draft #14276 → #14458 (all-backend BAB tests), #14456 (FXC rows + docs regen); chain-owned, no dispatch; re-check 11-25.
  - [Dated history](14259-hlsl-byte-address-store-history.md)
- [slang#14277 — GLSL two undeclared `local_size_*_id` → E99997 ICE (slang-check-modifier.cpp:2317)](14277-glsl-local-size-id-undeclared-constant-id-ice.md) — bot-filed 11-03, #14256 side-find (owned by that chain; no dispatch). DRAFT PR #14284 (peer R2), ready-flip pending.
- [slang#14282 — HLSL ROV `RasterizerOrderedByteAddressBuffer.Load<T>` emitted as `.Load<T >`, DXC rejects](14282-hlsl-rov-bab-templated-load-dxc-reject.md) — bot-filed 11-04 00:39Z by slang-triager, side-find S1 of slang-reviewer's R1 on PR #14276 (#14259 chain). Bug + `reproduced`. HELD on maintainer: jkwak-work self-assigned 11-04 17:31Z + Q1 2027 milestone. 11-09 recheck: no dispatch, no further timer.
- [slang#14283 — CPU/CUDA `RWByteAddressBuffer.Store<bool>` writes 1 byte instead of 4](14283-cpu-cuda-bab-store-bool-one-byte.md) — bot-filed 11-04 00:39Z (side-find of PR #14276 R1). HELD on maintainer: jkwak-work self-assigned 11-04 17:29Z + `Office-Yong` + Q4 milestone. Scalar bool is 1 byte by design in CPU/CUDA layout rules. Operator triage ask 11-05 answered; no dispatch.
- [slang#14323 — HLSL SM 5.0 (FXC) `double` byte-address Load/Store emits uint64 / templated calls](14323-hlsl-sm5-double-byte-address-uint64.md) — bot-filed 11-04, side find S3 of #14322 review (#14259 chain). Bug + `reproduced`; issue_opened needs NO dispatch. HELD maintainer-driving (jkwak-work self-assigned 11-06): no fixer, no ping, no timer. Listed in #14458.
- [slang#14386 — `FloatToHalf` narrows every NaN to signaling NaN 0x7C01/0xFC01](14386-floattohalf-half-nan-signaling.md) — bot-filed 11-06 16:14Z by slang-triager, side-find S4 from review of PR #14385 (#14259 chain). Bug + `reproduced`. FILED-ONLY (low severity; maintainer-written NaN comment from #13485; human PR #13927 adjacent); one-shot `recheck-14386-floattohal-2ff9`, 11-13.
- [slang#14327 — generic `sizeof(T)` T=bool gives 4, concrete `sizeof(bool)` gives 1](14327-generic-sizeof-bool-4-vs-concrete-1.md) — bot-filed 11-04 22:28Z by slang-triager, side-find of the #14157 bool-size answer (with docs/comment drift). Bug + `reproduced`. issue_opened needs NO dispatch; FILED-ONLY pending a maintainer 1-vs-4 decision. Siblings #14328 (host-cpp ICE) / #14329 (llvm-host-ir) same batch, also no dispatch.
- [slang#14302 — slangc: dedicated exit code (-2) for internal compiler errors](14302-ice-dedicated-exit-code.md) — human (jkwak-work) 11-04 06:45Z, assigned to author by jhelferty-nv; author's own fix PR #14303 (non-draft) up 33 s later. NO DISPATCH: maintainer-driving.
- [slang#14286 — slang-test does not find the Metal compiler on Windows when it is on PATH](14286-metal-compiler-windows-path.md) — human bug (jkwak-work, self-filed + self-assigned) 11-04. Author's own fix PR #14287 open (non-draft). NO DISPATCH: maintainer-driving.
- slang#14288 / #14289 (GLSL `local_size_x_id` default lost in GLSL emit / one `layout(...)` keeps only the last size-or-id per axis) — bot-filed 11-04 ~02:45Z, the #14277 reviewer's side-finds. FILED-ONLY, owned by the [#14277 chain](14277-glsl-local-size-id-undeclared-constant-id-ice.md); their issue_opened webhooks need NO dispatch. **HELD: jkwak-work self-assigned both 11-04 17:34Z, milestone Q1 2027; no dispatch, no bot post.**
- [slang#14304 — SPIR-V matrix `[i][j]`/`._mij` reportedly reads row 0](14304-spirv-matrix-row-indexing-not-reproduced.md) — human (JackOfBlades232) 11-04 09:45Z → slang-triager. NOT reproduced on L40S (codegen correct, full shader bit-identical under both layouts); TERMINAL 11-04: reporter withdrew + self-closed (RenderDoc debugger replay suspected). Optional RenderDoc upstream filing = operator FYI, default not filed.
- [slangpy#1260 — PyTorch bridge rejects torch.bfloat16](slangpy-1260-torch-bfloat16-dtype.md) — human 11-04; draft PR #1261 (R2 APPROVE, CI green), READY-FLIP PENDING (weekly list). Side finds #1262, #1264 and the bf16 SPIR-V rounding thread are owned here: no dispatch.
- [slangpy#1262 — Vulkan half-input bwds crashes without atomic_half](slangpy-1262-vulkan-half-bwds-atomic-half-segfault.md) — bot-filed 11-05 02:22Z by slangpy-triager, side-find of the #1261 R1 review (#1260 chain). issue_opened needs NO dispatch; fixer via triager handoff 02:25Z → draft PR #1263 (in review).
- [slangpy#1265 — `.bwds()` with torch `diff_pair()` output: CUDA abort / Vulkan zero grads](slangpy-1265-bwds-diff-pair-result-wiring.md) — bot-filed 11-05 05:00Z by slangpy-triager, side-find of the #1262/#1263 chain. issue_opened needs NO dispatch; FILED-ONLY (undocumented form, 3 drafts already pending humans).
- [slangpy#1271 — scalar vs float3 tensor perf gap; from_numpy vector dtype](slangpy-1271-scalar-vs-vector-tensor-perf.md) — human 11-11; triaged Q/P2 (default numthreads(32); `call_group_shape` workaround). Draft PR #1272 @f45ab617 (from_numpy stride check + docs, Refs) reviewed, PARKED on human review; ready-flip weekly list. Group size parked for maintainers (re-check 11-14). Side find #1273 filed-only.
- [slangpy#1273 — Vulkan bool Tensor copy_from_numpy/to_numpy mis-convert (4-byte vs 1-byte bool)](slangpy-1271-scalar-vs-vector-tensor-perf.md) — bot-filed 11-11 13:59Z by slangpy-triager, side find of the #1271/#1272 chain. issue_opened needs NO dispatch; FILED-ONLY. **Held 11-11 18:44Z:** jhelferty-nv assigned kaizhangNV + ccummingsNV and asked ccummingsNV (not the bot) whether it should work. No dispatch.
- [slang#14334 — SPIR-V hull/domain patch locations disagree (v2026.21 regression)](14334-hull-domain-patch-location-mismatch.md) — P1. PR #14335 READY, BLOCKED on #14375 (stage 1 = draft #14395, ready for a human 11-10). Side finds #14366/#14375/#14376/#14397/#14434 are bot filings: NO dispatch.
  - [Dated history](14334-hull-domain-patch-location-history.md)
  - [slang#14375 — global varyings and entry-point ownership (prerequisite)](14375-global-varying-entrypoint-ownership.md) — stage-1 draft #14395 waits on tangent-vector + a human review; re-check fired 11-11 (record only); webhook-only.
    - [Dated stage-1 history](14375-global-varying-entrypoint-ownership-history.md)
- [slang#14124 — E30027: extension method calling a same-extension member on another specialization](14124-extension-self-application-shared-param-e30027.md) — bot-filed 10-31 (follow-up of #13741). jkwak-work self-assigned 11-02 (Q1 2027): maintainer-owned, P3, no dispatch. Hypothesis in record.
- [slang#14349 — surplus attribute args not diagnosed (Debug assert / Release UB)](slang-14349-surplus-attribute-args-unchecked.md) — bot-filed 11-05 by the triager as a spin-off of #14135/#14149. **Owned by the #14135 chain**, so its issue_opened needs no dispatch. Fixer chain offered to the operator.
- [slang#14366 — explicit `[[vk::location]]` on patch-constant fields: ignored by hull, struct-relative in domain](14366-patch-field-explicit-vk-location.md) — bot-filed 11-05, owned by the #14334 chain; issue_opened needs NO dispatch. DECIDED 11-06: struct-relative stays; resolved when #14335 lands. Open Q to pdeayton-nv: keep E39034 as a separate PR?
  - [Dated history](14366-patch-field-explicit-vk-location-history.md)
- [slang#14377 — CUDA wave ops get the per-arm mask after if/else reconverges](14377-cuda-wave-mask-after-reconvergence.md) — human-filed 11-06 (albertrodriguezclo, #14016 reporter). Codegen-only bug: the reporter traced the wrong sums to the #13479 firstbithigh bug (already fixed). FOLDED 11-06 into the #14016 chain's draft #14050 (test + "Fixes #14377", via triager ktr6eo → fixer 7qx06k); closes on merge.
- [slang#14407 — render-test ignores indented `//TEST_INPUT:`](14407-render-test-indented-test-input.md) — human test-tooling bug 11-08, P3. **MERGED 11-09** as PR #14411 (4da025571), closed; terminal. Bot-filed follow-up **#14409** (its issue_opened needs NO dispatch) was self-assigned by jkwak-work 11-09, so it is held under rung 4 with no bot chain.
- [slang#14409 — render-test runs with unbound resource params (cpu/cuda crash slang-test)](14409-render-test-unbound-param-check.md) — bot-filed 11-08 by the #14407 triager as the split-out general check. Owned by the #14407 chain, FILED-ONLY; fixer chain offered to the operator, recheck 11-11. **11-10: jkwak-work self-assigned 11-09 17:38Z → operator ask withdrawn, held (rung 4).**
- [slang#14408 — SPIR-V/GLSL `Atomic<float|half|double>.compareExchange` emits integer-only CAS on a float type](14408-spirv-glsl-float-atomic-cas.md) — human-filed 11-08; draft PR #14412 (R1 nits applied), waiting on a maintainer; ready-flip on the weekly list. Owns bot #14410 (no dispatch).
- [slang#14410 — HLSL/CUDA `Atomic<half|double>.compareExchange` emits overloads DXC/NVRTC reject](14410-hlsl-cuda-atomic-half-double-cas.md) — bot-filed 11-08 by the #14408 triager as a side finding; owned by the #14408 chain, not dispatched separately.
- [slang#14427 — move CI workflows off `pull_request_target`](14427-ci-off-pull-request-target.md) — maintainer-filed + self-assigned (jhelferty-nv, jkiviluoto-nv) 11-09; CI policy deadline 12-02. Assignee plan 11-10: scoped exception first, then migrate `slash-cleanup` to a sweep. HELD rung 4/5: no dispatch, no post.
