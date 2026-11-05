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
- [slang#10232 — `double` on WGSL/Metal gives ICE E99997 instead of a diagnostic](10232-double-wgsl-metal-ice.md) —
  human (rkoivunen-sw, 02-26, `fuzzed`; assignee jkwak-work). 11-04 16:49Z jkwak-work asked the bot to triage, so it was DISPATCHED. TRIAGED 17:01Z P2 (cmt 6636793334, rec A). 17:59Z jkwak-work said to use the capability system instead (cmt 6638052514); relayed to slang-fixer vr0qdh. 19:07Z the fixer posted the fp64 plan (cmt 6639554148). 21:05Z jkwak-work answered by asking for the SUPPORT_DOUBLE guard on inf-float-literal.slang (cmt 6642103509), so the chain RESUMED. **Draft PR #14332** (head d144702bf, `pr: breaking change`, mapped to fixer vr0qdh) opened 11-05 ~00:55Z; ready-flip pending. PARKED on jkwak-work: fix the static-initializer and `-conformance` E99997 gaps here or in a follow-up? Peer review by slang-reviewer j98e8b. #10233 is the reporter's stale test-only draft.
- [slang#13972 — reflection says GLSL `readonly buffer` is mutable; WGSL now emits `read`](13972-glsl-readonly-buffer-reflection-wgsl-read.md) —
  bot-filed 10-28 (jkwak-work asked). PARKED on assignee pick A/B/C/D; GPU-confirmed regression in v2026.21 (v2026.20 OK); jkwak-work pinged 11-04 (cmt 6635682718); re-check t-72709c 11-11, no 2nd ping.
- [slang#14307 — WGSL crash: scalar uniform array element as call arg](14307-wgsl-scalar-uniform-array-call-arg-crash.md) — human (jackerley) 11-04 ~15:53Z, reporter says own PR ready. Same peephole hunk as #13380 / our draft #13381 (jkwak-work). Triaged 11-04 16:29Z: reporter's PR #14308 (ready) and our draft #13381 both fix it. PARKED on jkwak-work; no bot action.

- slang#14306 (`Ptr - unsigned` offset moves the pointer forward; u8/u16 on all targets) — bot-filed 11-04 15:27Z by slang-triager, side-find D of the [#14305 chain](14305-vulkan-negative-physical-ptr-arithmetic.md). issue_opened needs NO dispatch; FILED-ONLY, fixer = operator decision.
- [slang#14305 — Vulkan: negative physical-pointer arithmetic gives +4 GB displacement on NVIDIA](14305-vulkan-negative-physical-ptr-arithmetic.md) — human (tdavidovicNV, admin; unassigned) 11-04 15:00Z → slang-triager. Reproduced on L40S (cmt 6634383096); maintainer-owned since 11-04 18:20Z (assigned kaizhangNV, `RTR`; jkwak-work: "could be a driver bug"). No bot posts unless asked; triager re-check 11-09. Side bug `Ptr - unsigned` filed as **#14306** (8/16-bit wrong on all targets incl. SPIR-V); fixer = operator decision, default none.
- [slang#14298 — Metal combined sampler `Load()`/`operator[]` pass the sampler as the coordinate](14298-metal-combined-sampler-load-subscript-arg-index.md) —
  external (kovidgoyal) 11-04 04:49Z; dup of #10522/#13737, fixed by draft #13741 (triager-verified). Triaged 05:18Z (cmt 6623234116); owner asked to add `Fixes #14298`.
- [slang#14297 — `countof(Tuple<expand Wrap<each T>>)` returns 1, not the pack size](14297-countof-tuple-expand-generic-pack-size.md) —
  maintainer (jkwak-work) self-filed + self-assigned 11-04 04:35Z, found via #14292 (sibling #14296, also self-assigned). 16:34Z maintainer asked bot to triage + PR. TRIAGED 16:49Z (P2, `maybeSpecializeCountOf` missing `kIROp_Expand`); draft PR **#14313** (223ffa9f5, reviewer APPROVE_WITH_NITS); PARKED on maintainer ready-flip (weekly list). Side-find filed as **#14309** (Tuple<expand Wrap<each T>> field + default ctor → E99997); its issue_opened belongs to this chain, so do not dispatch it; FILED-ONLY. Second side find **#14316** (`__shapeReduce` countof segfault): same rule; its issue_opened arrived 11-04 and was not dispatched. Reviewer side finds S1+S2 filed as **#14318** (pack queries/`__packBranch` on a mixed expand tuple): same rule, issue_opened received 11-04, not dispatched. Third **#14318** (ConcreteTypePack helpers ignore `expand` elements; S1+S2 from review): same rule.
- [slang#14296 — `__trimFirst`/`__trimLast` value-pack queries fail inside `expand` (E39999/E30105)](14296-pack-query-in-expand-pattern.md) —
  maintainer (jkwak-work) self-filed + self-assigned 11-04 04:35Z, found via #14292 (sibling #14297). 11-04 reporter asked the bot to triage + PR → TRIAGED P2 16:49Z; **draft PR #14314** 18:05Z (fixer `sess-1793810963009-n3vn10`). Ready-flip pending, weekly list. Side find **#14320** (bot-filed, unequal-length expand) belongs to this chain, so do not dispatch it; its issue_opened arrived 11-04 and was not dispatched.
- [slang#14295 — extension members on `Ptr<T>`/`T*` not found on a pointer value (E30027)](14295-ptr-extension-instance-method-lookup.md) —
  maintainer (jkwak-work) self-filed + self-assigned 11-04 04:30Z, found via #14292. 16:34Z jkwak-work asked the bot to triage + make a PR. TRIAGED 16:43Z P2 (eager `maybeDereference` skips lookup's Ptr fallback; approach A); DRAFT PR #14317 @b920f0375; peer R1 REQUEST_CHANGES (B1 double evaluation) → R2 d7b13fd APPROVE_WITH_NITS 21:30Z; nits applied, final head 1fd61c1. RESOLVED 22:09Z; READY-FLIP PENDING on jkwak-work (CI is skipped while the PR is a draft). #14299 merges with no conflict and silently re-disables the test; the second to land must remove that line.
- [slang#14268 — mixed `Ptr` `==`/`!=` compares nullness via implicit Ptr→bool](14268-mixed-ptr-equality-nullness.md) —
  human (tdavidovicNV) 11-03, silent wrong code. TRIAGED P2 22:24Z (repro master f1cd35ff8, L40S vk+cuda). Reporter 11-04 16:37Z widened it to Ptr-vs-number and arbitrary bool-convertible types (repro 3da6f63c0; rec now contextual-bool + diagnostic, joint decision w/ #14086). PARKED on maintainer semantics; no fixer. Re-check t-d8d291 11-07 16:00Z.
- [slang#14294 — win-test-* (GCP-T4) runners lost at ~03:25Z / ~03:42Z UTC](14294-win-test-runner-loss-0325z.md) —
  bot-filed CI infra. No dispatch, no bot post; 2 jobs spot-verified. Operator already alerted by a sibling session (dashboard seq 510698); I posted nothing more. One-shot recheck 11-05 04:05Z.
- [slang#14252 — SM80Plus self-hosted runners stalled since 17:43Z 11-03](14252-sm80plus-runners-stalled.md) —
  bot-filed CI infra (recurrence of #13614). No dispatch, no bot post. Brief recovery 20:11–20:18Z (#14111 merged 21:05Z), re-stalled after; #14204 dequeued 21:42Z. Operator told to ping jkiviluoto-nv (21:53Z). No timer.
- [slang#14248 — GLSL `inverse(matrix)` only GLSL/SPIR-V; HLSL etc. E36107](14248-glsl-inverse-hlsl-other-targets.md) —
  maintainer (jkwak-work) self-filed + self-assigned 11-03 18:44Z with own proposal. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14247 — `printf` with `ConstantBuffer<uint>` arg → ICE "Unknown legalized val flavor"](14247-printf-constantbuffer-legalized-val-ice.md) —
  human (jkwak-work, self-assigned) 11-03, triaged P2. Draft PR #14253 (frontend fix, +334) **CLOSED by jkwak-work 21:11Z as overkill**; the issue is marked unplanned (workaround: an explicit cast). **CLOSED on our side** 21:16Z (all three coworkers stood down; ack 6615602966).
- [slang#14235 — CUDA global const from pure `[ForceInline]` helper keeps a call under `-g` (G2 from #14150)](14235-cuda-global-const-g-debug-inline.md) —
  human (jvepsalainen-nv) 11-03 07:15Z with own fix PR #14236 (G2 only). #14150 merged 02:06Z with G1+G2 unaddressed. G1 filed as **#14238** (bot, 07:28Z; its `issue_opened` belongs to the #14133 chain, so do not dispatch it). Operator asked 07:30Z about a #14238 fixer chain.
- [slangpy#1258 — intermittent macOS Metal Debug pointer tests read back all zeros](slangpy-1258-metal-debug-pointer-all-zero.md) —
  human (tdavidovicNV) 11-03, found while validating #1257/#1256. TRIAGED 06:29Z P2: lead = slang-rhi Metal useResource fallback misses pointers stored inside buffers (code verified; runner path unverified). PARKED on tdavidovicNV for diagnostics A; no rhi filing until a failing run shows the fallback. Re-check t-be5a18 11-06.
- [slang#14231 — differentiable generic-extension method via interface param → E33180 (2025+)](14231-tensor-interface-diff-extension-e33180.md) —
  human bug 11-03 (blocks slangpy#1256). TRIAGED 05:27Z; §3 fixed on master by #13742. Draft PRs #14233 (§4, #14232) and #14234 (§1) need human Ready; #14237/#14239/#14240 bot-filed, **self-assigned by jkwak-work 11-04, so no fixer unless asked** (their issue_opened needs no dispatch). §3 ships in v2026.21.
- [slang#14222 — generic `T(uintVar)` converts through int (≥ 2^31 → negative)](14222-generic-float-init-from-uint-via-int.md) —
  bot-filed side find S1 from the #14062 review, 11-03. FILED-ONLY; dispatch when #14218 merges (timer `recheck-14062-pr14218-55f1`).
- [slang#14211 — double core-module constants float-rounded (getPi)](14211-core-module-double-constants-float-rounded.md) —
  bot-filed side find from #14062, 11-02. FILED-ONLY; dispatch to slang-fixer when #14062 PR #14218 merges.
- [slang#14020 — RFC: standard module for small dense linear algebra](14020-dense-linalg-module-rfc.md) —
  human RFC 10-29, triaged P3, no fixer. On 11-02 jhelferty-nv suggested a separate repo + package manager, and on 11-03 the author accepted. **CLOSED on our side** (t-4765e8 cancelled), and the issue stays open. A new human comment is a closed-chain live inbound for the triager.
- [slang#14190 / #14191 / #14192 / #14193 — #14183 side bugs (accessor caps; LLVM atomics; Append/Consume; location-less span text)](14190-14192-cpu-atomic-side-bugs.md) —
  BOT-filed 11-02 ~15:17–15:58Z by the #14183 triager. Filed-only; **their issue_opened needs no dispatch**. **Maintainer-owned** (jkwak-work self-assigned all four 11-02 18:14–18:21Z, milestone Q1 2027); fixer go/no-go withdrawn 11-04, no timer.
- [slang#13251 — out-param lowering wrapper shares the original's DebugFunction](13251-out-param-debugfunc-share.md) —
  latent P3; draft PR #13252 held for owner jkwak-work. **Parked 11-02** after 3 unanswered operator asks; default is to keep holding, no re-chase scheduled.
- [slang#14183 — CPU `Atomic<float>::add` -> E99999 in emit](14183-cpu-atomic-float-add-ice.md) —
  human bug 11-02 13:33Z, triaged P2 (approach B). Draft PR #14189 @555cf1f, R1 nits applied; **needs a human "Ready for review"**. Side bugs #14190–#14193 need no dispatch; maintainer-owned (jkwak-work self-assigned 11-02), fixer go/no-go withdrawn 11-04.
- [slang#14182 — Metal vector atomics emit `atomic_packed_*`](14182-metal-vector-atomic-packed.md) —
  BOT-filed 11-02 12:39Z by the #14153 fixer (side finding, low priority). Filed-only; fan-out held; **its issue_opened needs no dispatch**.
- [slang#14181 — existential tuple: reflection says 16+N bytes, emit pads it (std140 N<16, CUDA N=4/12); maintainer-driving (jkwak self-assigned, tangent-vector: warn + round up to 16)](14177-render-test-untyped-object-conformance-id-session.md) —
  BOT-filed 11-02 12:34Z by the #14177 triager (side find (b)). Filed-only; **its issue_opened needs no dispatch**. Record lives in the #14177 chain file.
- [slang#14180 — static specialization of an interface-array field passes the AnyValue payload to the concrete method](14177-render-test-untyped-object-conformance-id-session.md) —
  BOT-filed 11-02 12:28Z by the #14177 triager (side find (a)). Filed-only; **its issue_opened needs no dispatch**. Record lives in the #14177 chain file.
- [slang#14177 — render-test untyped `new{...}` input takes its conformance ID from slang-rhi's device session](14177-render-test-untyped-object-conformance-id-session.md) —
  human test-harness bug 11-02 12:06Z, triaged P2 (rec A). Parked on R6 to 11-06 (one-shot r6-release-14177-c2f9). Reporter fix PR #14178; the slang-rhi half is slang-rhi#965 (triager, one-shot r6-release-rhi-965-f9f6), tracked in this record.
- [slang#14173 — SPIR-V: `Atomic<float>.sub` aborts with "Unhandled global inst in spirv-emit: neg"](14173-spirv-atomic-float-sub-neg-ice.md) —
  BOT-filed 11-02 11:49Z by the #14153 fixer (side finding). Filed-only; fan-out held; **its issue_opened needs no dispatch**. ICE reproduced by me 11:52Z. **Maintainer jkwak-work self-assigned (milestone Q1 2027) 11-02 18:33Z**, so no fixer chain; operator ask withdrawn 11-04 12:00Z; no timer.
- [slang#14174 — Metal: `Atomic<T>.store` on `half`, or on `float` in groupshared memory, emits atomics MSL lacks](14174-metal-atomic-store-half-groupshared-float.md) —
  BOT-filed 11-02 11:49Z by the #14153 fixer (side finding). Filed-only; fan-out held; **its issue_opened needs no dispatch**. Reproduced by me; parked on an operator go/no-go (would stack on #14060's helper); one-shot re-check ran 11-04 12:00Z: no answer, reminded once, now parked with no timer.
- [slang#14175 — Metal: groupshared float atomic add/sub needs MSL 4.1, but Slang compiles for metal3.1 with no diagnostic](14175-metal-groupshared-float-add-msl41.md) —
  BOT-filed 11-02 11:49Z by the #14153 fixer (side finding). Filed-only; fan-out held; **its issue_opened needs no dispatch**.
- [slang#14162 — float `InterlockedAnd/Or/Xor` accepted on every target](14162-float-bitwise-interlocked-ops.md) —
  BOT-filed 11-02 10:23Z by the #14153 triager (side finding). Filed-only; fan-out held; **its issue_opened needs no dispatch**. **Maintainer-owned** (jkwak-work self-assigned 11-02 18:37Z, milestone Q1 2027); fixer go/no-go withdrawn 11-04, no timer.
- [slang#14153 — Metal `RWTexture2D<float>.InterlockedAddF32` emits non-existent `atomic_fetch_add`](14153-metal-float-texture-atomic-add.md) —
  human bug (albertrodriguezclo) 11-02. **DEFERRED 12:22Z to the reporter's PR #14170**; the bot branch stays local, nothing posted. Triager stood down; awaiting the fixer's close-out.
- [slang#14160 — Metal emits `[[raster_order_group(0)]]` on a ROV in a compute kernel](14160-metal-raster-order-group-compute.md) —
  human bug 11-02; Triaged bug/medium/P2 (Metal emitter, no stage check). R6 to 11-06 10:04Z (one-shot r6-release-14160-aa3d). No fixer; operator asked 11-02.
- [slang#14166 — Metal ROV in a ParameterBlock gets no `[[raster_order_group]]`](14166-metal-rov-parameterblock-no-raster-order-group.md) —
  bot side bug from the #14160 triage (DescriptorHandle(ROV) misses the emit hook). Not dispatched; a fixer chain waits for the operator's OK (asked by the #14160 session), bundle with #14160.
- [slang#14152 — `inout IFoo` on a uniform-struct interface field mixes two existential layouts](14152-inout-existential-field-layout-mismatch.md) —
  human bug (albertrodriguezclo) 11-02 10:04Z; Metal rejects, HLSL mistyped, slangc exits 0. Triaged bug/medium/P2, rec A (copy in/out through a tagged-union temp in typeflow-specialize). PARKED: R6 to 11-06 10:04:23Z (`r6-release-14152-013b`), then post + fixer.
- [slang#14155 — C-like targets emit INT64_MIN as `-9223372036854775808LL`](14155-int64-min-literal-emit.md) — human bug (albertrodriguezclo) 11-02 10:04Z; reporter has a fix prepared (Int64 case only; expect own PR). TRIAGED 10:17Z bug/medium/P2: IntPtr + GLSL sites also affected, and `case INT64_MIN:` is a hard error. Draft held under R6 to 11-06 10:04Z (`r6-release-14155-755e`). Same value, other layer: #13986.
- [slang#14156 — Metal emits `vector<intptr_t/uintptr_t,N>` as scalar `long`/`ulong`](14156-metal-intptr-vector-emit.md) —
  human bug (albertrodriguezclo) 11-02 10:04Z; reporter has a 2-line fix prepared. Triaged P2, rec A (+ packed-vector surface). PARKED on R6 (to 11-06 10:04:30Z); triager one-shot `r6-release-14156-3c09` 11-06 10:10Z; no fixer without the reporter/maintainer go-ahead.
- [slang#14154 — Metal read-only StructuredBuffer/ByteAddressBuffer emitted as writable `T device*`](14154-metal-readonly-buffer-const-device.md) —
  human bug 11-02; Triaged bug/low/P2. Reporter offered the PR, so no bot fixer chain. PARKED on R6 (to 11-06 10:04Z, one-shot r6-release-14154-33ea), then csyonghe.
- [slang#13206 — logical pointers in structs (draft PR #13305)](13206-logical-pointer-struct-legalization.md) —
  draft PR parked on tangent-vector's A/B/C array-scope question since 09-29. The operator ping ask was withdrawn as over-gated on 10-31; the fixer (etva7e) is doing a master merge and a no-ping comment. One-shot 11-07 parks the chain with no timer.
- [Nightly agentic-tests stale fixtures (#13810, #13887)](nightly-agentic-fixtures-13810-13887.md) —
  **TERMINAL 11-03:** jvepsalainen-nv's #14172 fixed all 13 stale fixtures. #13887 is closed as superseded. #13810 is now a +21 PR-CI test draft (`63fb5ef75`) on the weekly ready-flip list. Side find #14134 (formatting.sh unquoted `$@`) is filed-only and parked on a maintainer decision.
- [Nightly sanitizer — render-test gradient NaN cast](nightly-sanitizer-render-test-gradient-nan.md) —
  10-31 nightly UBSan red (`shader-input-layout.cpp:1564-1566`), filed #14121. **TERMINAL:** fixed by jkwak-work's #14163 (our draft #14122 closed as dup); 11-03 nightly green — closed-verified. Side finds slang-rhi#960, #14131.
- [slang#14112 — modf (float, out int) overload](14112-modf-float-out-int-overload.md) —
  tangent-vector's own feature request (self-assigned), P2, rec A. PARKED on the reporter; R6 to 11-03, triager one-shot t-b0c226; no fixer without the reporter's go-ahead.
- [slang#14103 — IGlobalSession::parseCommandLineArguments returns SLANG_OK for invalid arguments](14103-parse-command-line-arguments-ignores-errors.md) —
  human bug (`bot-ok`). **TERMINAL**: PR #14111 (parse-purpose redesign) merged 11-03 21:05Z (`f1cd35ff8`), issue closed; slangc follow-up #14195 (jkwak-work, no dispatch) open. No timer.
  - [Dated history](14103-history-triage-to-ready.md)
- [slang#14214 — SPIR-V constant resource choice across helper call / struct copy → E56004](14214-constant-resource-choice-fold.md) —
  human bug (pdeayton-nv, `bot-ok`), constant-condition sibling of #14101; bug/P2, A1 (SRU inline fallback) + A2 (SSA field-store promotion). PARKED on the reporter; no fixer. One-shot t-815b50 11-06 16:10Z.
- [slang#14101 — SPIR-V `?:` between independently declared Texture2D/SamplerState/Buffer → E56004](14101-spirv-select-independent-resources.md) —
  feature/P2, PARKED on the reporter; no fixer. Side find **#14102** was bot-filed (its webhooks need no dispatch). One-shot t-5434f7 11-06 16:00Z covers both.
- [slang#9643 — overlapping push-constant ranges across vertex/fragment EPs (SPIR-V)](9643-overlapping-push-constant-ranges.md) —
  jkwak-work picked A → draft PR #14108 (R1 AWN applied) parked on 2 merge-blocking questions to jkwak-work; S1 filing held. Still parked at 11-04 re-check; final one-shot `recheck-slang-9643-pr141-26da` 11-11, then supervise-issues register. Related: slangpy#1232 / #13713.
- [slang#14071 — CUDA separate-sampler SampleGrad rejected vs SampleLevel dropping the sampler](14071-cuda-separate-sampler-samplegrad.md) —
  human feature request (minco3) 10-29, P3, PARKED for jkwak-work (now assignee) on A/B/C; triage comment 6591886780 posted 11-03; re-check `t-35ef08` 11-10 00:10Z. Owns #14073 (F4 open) and #14083 (parked) — dispatch nothing on their webhooks.
  - [Dated history](14071-cuda-separate-sampler-history.md)
- [slang#14077 — DXR CreateStateObject crashes (NVIDIA) for TraceRay in a `[noinline]` helper](14077-dxr-noinline-traceray-pipeline-crash.md) —
  P3; likely a driver issue (DXIL matches DXC). Parked on the reporter; re-check t-c511aa ran 11-03 (no reply; reporter's fork draft rejects a compiler workaround); no timer left, no fixer.
- [slang#14075 — generic `where T.A == C` does not satisfy an interface `__constraint` equality (E38029)](14075-generic-assoc-equality-conformance.md) —
  human bug (kaizhangNV, MEMBER, self-assigned) 10-30 00:19Z, portable-RT. Triaged bug/medium/P2; distinct from #13509 (equality-side sort + one-way isSubtype; order-dependent). Bot comment 6592159047 posted 11-03. PARKED on the reporter's go-ahead; triager one-shot t-567683 11-10 00:30Z.
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
- [slang#14053 — overloaded same-name compute entry points → invalid CUDA/Metal/SPIR-V, no diagnostic](14053-overloaded-entry-points-same-name.md) —
  human bug (albertrodriguezclo) 10-29, P2. Bot DRAFT PR #14221 (R3 APPROVE_WITH_NITS; conflicts with reporter PR #14147). PARKED 11-03 on operator un-draft sign-off; re-chase `rechase-slang-14053-r1-2e4f` 11-05. Split issues #14228/#14229/#14230 belong to this chain (no dispatch).
- [slang#14054 — Metal compareExchange is a single weak CAS (spurious failure reads as success)](14054-metal-weak-compare-exchange.md) —
  human bug (albertrodriguezclo, cloth-sim batch) 10-29 21:51Z; Metal twin of #13917/#13918. Triaged 22:08Z: premise contested (MSL spec reads strong). Park posted 11-02 21:56Z; awaiting assignee jkwak-work; re-check t-c62394 11-09.
- [slang#14058 — Metal discarded atomic results → `-Wunused-variable` temps](14058-metal-discarded-atomic-unused-variable.md) —
  human bug, P2, widened to all 0-use IRCalls. Draft PR #14209 (R1 APPROVE_WITH_NITS applied) PARKED on operator un-draft; re-chase `rechase-slang-14058-r1-1d3f` 11-05 16:00Z. Owns filed-only #14216 (dispatch nothing). ⚠️ Overlaps #14044/#14170.
- [slang#14057 — warn when an unsuffixed float literal is rounded to float then used as double](14057-unsuffixed-float-literal-double-warning.md) —
  human feature request (albertrodriguezclo) 10-29, P3, reproduced. PARKED on 4 jkwak-work/skiminki-nv decisions (new value-gated warning); re-check `t-aec81c` 11-09. Overlaps #14062 and stale bot draft #12932.
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
  split: draft PR #14092 (crash→error, AWN applied, ready flip asked); bug 2 (std modules under `-obfuscate`) parked on a maintainer, one-shot t-e356e3 11-06.
- [slang#14089 — `void*` arithmetic: 4-byte stride on SPIR-V vs error/1-byte on C-like targets](14086-14089-pointer-semantics-parked.md) —
  BOT-filed 10-30 04:58Z by slang-triager (a #14088 side find), P2. PARKED on a maintainer choosing the semantics; one-shot t-e18700 11-06 16:30Z. Its `issue_opened` webhook needs no dispatch. Spawned by the #14055 chain.
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
  human regression from #6627 (albertrodriguezclo), P1, assignee jkwak-work. Main overrode the stale-rule timer stand-down. **Draft PR #14203** @ 5872fb173 passed R2 review (APPROVE_WITH_NITS) and is PARKED on the ready flip or the assignee. Held side finds filed 11-02 as #14205–#14208 (filed-only).
- [slang#14060 — Metal rejects `Atomic<float>` load/exchange/CAS (E55204)](14060-metal-float-atomic-load-exchange-cas.md) —
  human (albertrodriguezclo) 10-29, P2, sibling of #14054 (own chain). PR #14210: jkwak-work ready-flip + 6 inline comments 11-04 23:22Z; all answered 11-05 01:25Z (head 3556907fe, MERGEABLE; mapping → chain session ytzi3p). PARKED on jkwak-work's option 1/2 choice (comment 6); CI run 41948210276 on new head waiting; approver paused. Re-check recheck-14210-human-6a1f-ddb2 11-06 22:00Z.
- [slang#14035 — Metal/WGSL reject `&ptr[i]` (`operator&` gated cpp_cuda_spirv_llvm)](14035-metal-wgsl-address-of-device-pointer.md) —
  human feature request (albertrodriguezclo) 10-29, cloth-sim batch, P3, reproduced. Type and `reproduced` set. PARKED on jkwak-work/aidanfnv (A widen gate / B diagnostic / C #10206) because `&` is slated for deprecation; 5-bullet posted 11-02 (6583479145); re-check `t-b1a9ee` 11-09 17:15Z.
- [slang#14036 — CUDA `precise` / `-fp-mode precise` → `_rn` intrinsics (FMA contraction)](14036-cuda-precise-fp-mode-rn-intrinsics.md) —
  human feature request (albertrodriguezclo) 10-29, cloth-sim batch, P2. Triaged and reproduced. Parked 5-bullet posted 11-02 17:32Z (cmt 6583831492). PARKED on jkwak-work/tangent-vector (approach A vs the #13324 overlap); no timer except the supervisor register.
- [slang#14037 — CUDA source output needs `-DSLANG_CUDA_ENABLE_HALF` for `half`](14037-cuda-half-enable-define.md) —
  human bug (albertrodriguezclo) 10-29, P2. DRAFT PR **#14194** (R2, nits applied) PARKED on humans: a maintainer must commit the CI-step hunk (bot lacks `workflows` permission), then un-draft; re-check `i14194-recheck-4c40` 11-09. Side finds #14196/#14199 are bot-filed (no dispatch).
- [slang#14034 — WorkgroupCount() on CUDA (gridDim) / Metal ([[threadgroups_per_grid]])](14034-workgroupcount-cuda-metal.md) —
  human feature request (albertrodriguezclo) 10-29, P2, reproduced. Fix = the #13920 WGSL pattern for cuda/metal. Parked 5-bullet posted 11-02. PARKED on maintainer direction (likely reporter PR, see sibling #14148); re-check `t-f136f9` 11-09 17:15Z.
- [slang#14151 — Metal `SV_GroupIndex` subscripts a narrowed scalar `SV_GroupThreadID`](14151-metal-groupindex-scalar-groupthreadid.md) —
  human bug (albertrodriguezclo) 11-02 10:04Z, invalid MSL (`gtid[2]` on a `uint`). Triaged P2, reproduced, order-dependent (uint2 = silent OOB). **Maintainer fix: jkwak-work PR #14326** (replaces reporter #14169; no `Fixes #14151`). No bot fixer. Triager one-shot i14151-r6-recheck-e401 11-06 10:10Z verifies #14326, no post.
- [slang#14157 — Metal/WGSL `ByteAddressBuffer` `bool` load/store bit-cast](14157-metal-wgsl-bab-bool-bitcast.md) —
  human bug (albertrodriguezclo) 11-02 10:04:32Z; reporter states a prepared fix (expect a reporter PR). Triaged Bug/P2 11-02 (Approach A, legalize-side; supersets #10207). Reporter PR #14167 (open). 11-04 jkwak-work asked the bot bool size per target; answered 6643360049 (11-04 22:07Z); side-finding filings (sizeof(T) bool, docs, host-cpp ICE #14328, llvm-host-ir ICE #14329) owned by this chain, filed-only. R6 hold was stale; `t-92b792` to edit in place or cancel.
- [slang#14136 — Metal `[[threads_per_threadgroup]]` / CUDA `blockDim` (dispatched group size)](14136-metal-threads-per-threadgroup.md) —
  human feature request (albertrodriguezclo) 11-01, P2, reproduced (no Metal workaround). **Reporter PR #14148 open 11-01 23:08Z (`Fixes #14136`).** Was PARKED on maintainer API pick (A opt-in getter / B semantic / C dynamic `WorkgroupSize()`); stack after #14034. R6 to 11-05 14:29Z; re-check `t-c5502a` 11-05 14:30Z.
- [slang#14027 — parallel-primitives standard module (block/device scan, reduce, sort)](14027-parallel-primitives-standard-module.md) —
  human feature/design proposal (albertrodriguezclo) 10-29, P3. CLOSED 11-02: the reporter goes package-first, and the stand-down was posted (6582500256). It filed #14140 (CUDA globallycoherent). My 10-29 R6 flag was wrong: merged R6 has no wait.
- [slang#14311 — D3D nested-struct layout: StructuredBuffer vs raw `Load<T>` vs reflection](14311-d3d-nested-struct-structured-vs-raw-layout.md) —
  human-filed 11-04, assigned kaizhangNV (routing). Triaged 17:56Z (cmt 6637980577) and parked on a maintainer pick: (A) D3D SB reflection fix A1–A4, (B) raw/structured contract B1–B4. Triager re-check t-a3af10 11-11 17:00Z.
- [slang#12714 — layout rules: docs #12716 + `-layout-rules-version 202c` draft #13300](12714-layout-rules-version.md) —
  parked since 10-01 on jkwak's GLSL pick, then tangent-vector concurrence; triager owner `…1053r5` (not zjzu07, which is the fixer). 10-29 cloth-sim pointer-layout comment reproduced + answered. 11-02: over-gated operator menu withdrawn; no-ping nudge on #13300; master merge deferred to jkwak's pick.
- [slang#14032 — struct alignment control (`[Align(N)]`)](14032-struct-alignment-attribute.md) —
  feature P2, **human-owned** (assignees jkwak-work + skiminki-nv, 11-02); no fixer handoff unless asked; parked 5-bullet 6583572483; re-check `t-51299f` 11-09 17:20Z. CUDA side bug **#14040** is owned by this chain (its webhook needs no dispatch).
- [slang#14029 — CUDA grid-wide sync intrinsic + cooperative-launch reflection](14029-cuda-grid-sync-cooperative-launch.md) —
  human feature request (albertrodriguezclo) 10-29, P2. Triaged; side finding: `-target ptx` + `<cooperative_groups.h>` fails on NVRTC 12.6 (prelude typedef clash). PARKED on maintainer design decisions. Parked 5-bullet posted 11-02 16:32Z (cmt 6582487816); next re-check `t-dc64ec` 11-09 16:30Z.
- [slang#14013 — explicit vk::binding(0) + global uniform, CB binding on the scope var layout](14013-vk-explicit-binding-global-cb-reflection.md) —
  bot DRAFT PR #14023 (R1 AWN applied), review-complete. **PARKED, NO TIMER since 11-04** (3 un-draft asks unanswered; ready-flip pending, weekly list). jkwak-work assigned and milestoned it 11-02. Reopens on a human comment, GitHub activity, or "un-draft 14023". Companion slang-rhi#959 is owned here (no dispatch).
- [slang#8557 — Std430DataLayout missing, GLSL→WGSL](8557-glsl-to-wgsl-std430datalayout.md) —
  maintainer re-triage ask (jkwak-work) on 10-28. Verdict: #13908 alone doesn't fix it, and it can close once human PR #13935 merges. PARKED on the maintainer. r1 fired 11-04: #13935 still open → no action, no re-arm; weekly parked digest covers it.
- [slang#13982 — `-g` emits DebugSource for an unused imported module](13982-spirv-debugsource-unused-import.md) —
  external report (jhelferty-nv retyped it Bug→Feature 11-04), P3; bot draft PR #13992 (module-version collision). PARKED on operator un-draft sign-off (asked 3×), then a #7203 maintainer question; 11-04 jhelferty-nv asked tangent-vector to comment. Last re-chase `rechase-slang-13982-r3-fc3b` 11-05 16:00Z.
- [slangpy#1227 — Vulkan .bwds() gradient in grad[0,0], RTX 5090 driver 617](slangpy-1227-vulkan-bwds-grad-rtx5090-driver.md) —
  bot-filed off the #1167/#1225 chain. 10-28 jkwak-work took it over (driver bug route). Optional operator "repro" offer, default nothing; no timer.
- [slang#13804 — SPIR-V decorations on global resource OpVariables](13804-spirv-decorations-global-resources.md) —
  feature request, P2. Side-bug crash fix is bot draft PR #13809 (kaizhangNV, 0 reviews). The feature waits on tangent-vector (assignee) to pick A/B/both. PARKED 10-28 in the register after re-check t-26dd74 found no change; no re-arm.
- [slang#13964 — HLSL default-inout receiver rejects immutable receivers](13964-hlsl-default-inout-receiver-immutable.md) —
  regression from #13615, P1; bot draft PR #13966 (new warning E30134), design settled 10-28. PARKED on operator un-draft sign-off (3rd ask 11-02); final re-chase `rechase-slang-13964-r3` 11-05 16:00Z.
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
  human-filed (skiminki-nv) design question. Tentative C++ direction 10-21 superseded 10-26 by #13956 (202c overhaul; wildcard imports lowest = option C). Bot plan withdrawn (cmt 6315330488 edited). HELD on the assignee; triager re-check `t-ab041d` 11-09.
- [slang#13888 — spurious outer-scope candidates for ambiguous lookup](13888-ambiguous-lookup-spurious-candidates.md) —
  CLOSED WNF 10-26 by skiminki-nv (issue + PR #13889); superseded by the 202c overhaul, tracked in #13956. Terminal; re-chase cancelled.
- [slang PR #12674 — attribute-name parsing](12674-attribute-name-parsing.md) —
  bot PR pushed 10-24 (head c7879c5a31), CI green. **Parked on maintainers**; webhooks deliver replies to the fixer.
- [slang PR #11387 — autodiff readNone carry gate](11387-autodiff-readnone-carry-gate.md) —
  bot PR waiting on jvepsalainen-nv (A)/(B) + #12502 placement; CI green bar falcor. Next one-shot `rechase-11387-maintainer-3d96` (11-07).
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
  Draft PR #13872 kept open; design rejected 10-30 (IR debug-info redesign wanted), tracked by #14106 (owned by fixer efb8e6, no dispatch); phase-1 draft #14114 waits on the efb8e6 ceiling. 11-02: jhelferty-nv assigned #14106 to pdeayton-nv and asked them about its origin. The question was not to the bot, so no reply. ⚠️ stable id 910 collides with #13564. Detail in the record.
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
  DRAFT PR #13826 (R2 AWN applied) PARKED on jkwak-work review + falcor-ci approval. Operator: 3 filing GOs pending.
- [slang#13824 — render-test binds a Texture2D.Handle input as a Vulkan storage image](13824-render-test-texture-handle-storage-image.md) —
  external (albertrodriguezclo) 10-21. Render-test bug, not emit. PR #13829 @2a6ef6a APPROVED by jkwak-work with auto-merge on (11-04); the merge waits only on a human approving `falcor-build-approval-gate`. 2 unfiled side bugs await the operator.
- [slang#13817 — type-flow: generics over a dynamic associated type, two conformances](13817-typeflow-dynamic-assoc-type-two-conformances.md) —
  DRAFT PR #13820 PARKED on assignee saipraveenb25's scope reply (cmt 6475284726). One-shot `recheck-slang-13817-6f27` 11-07 17:30Z.
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
  triaged 10-29 (bot cmt welcomes j8asic's PR, no bot fix). PARKED on the author. Couples to author PR #953 and #862/#869. Triager re-check t-9540e9 11-05 09:00Z.
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
  DRAFT PR #13659 (review cap reached) PARKED on shepherd kaizhangNV accepting the semantics; CI approval-gated. Gaps #13675 + #13683 are owned here (no dispatch on their webhooks).
- [slang#13634 — WGSL BAB `Load<half>` → E56103](13634-wgsl-bab-load-half-int16.md) —
  TERMINAL: closed 10-21 via reporter PR #13647; fixer stood down. Gaps 2/3 (struct `bit_cast` half, any-value half) are unfiled, waiting on the operator.
- [slang#13661 — WGSL BAB `Store<half>` rejected; atomic view?](13661-wgsl-bab-store-half-atomic-view.md) —
  triaged P2; the reporter owns every fix path (#13735, #13852, Metal filing), jkwak-work assigned. Bot hands off; waiting on jkwak-work's reviews. No timer.
- [slang#13654 — Metal `StructuredBuffer<S>` with a `Texture2D` field aborts slangc](13654-metal-structuredbuffer-texture-field-abort.md) —
  DRAFT PR #13681 PARKED on maintainer review + operator (ready/CI, 2 unfiled side-finds); do not re-ask. Re-check `rechase-13654-pr13681-a39d` 11-05 08:00Z.
  - [Triage/fix/GPU history](13654-history-triage-fix-gpu.md)
- [slang#13643 — WGSL address-space specialization re-clones its own clones](13643-wgsl-address-space-specialization-reclone.md) —
  TERMINAL: reporter PR #13648 MERGED 10-21, issue closed. #12563 must rebase onto it.
- [slang#13721 — `extension N::T` body can't see `N`'s members](13721-extension-namespace-qualified-target-lookup.md) —
  human language-semantics question (skiminki-nv), P2; lookup is lexical-only. PARKED on a maintainer pick of A/A′/B/C; no fixer. Next re-check `t-aaff5f` 10-30.
- [slang#13688 — Metal inline RayQuery fixed tags (no curves / multi-level)](13688-metal-rayquery-curves-multilevel.md) —
  human Metal feature/design question, P3. PARKED on kaizhangNV (assigned, Q4); tracked in supervisor-state. Sibling #13690.
- [slang#14007 (+ #14006) — Metal ParameterBlock combined Sampler2D Load/GetDimensions](14007-metal-parameterblock-combined-sampler-texture-only-ops.md) —
  one fixer chain for both; DRAFT PR #14017 (stacked on #13741 — never push to #13741) PARKED on falcor-ci + ready flip. Owns #14041/#14042 (no dispatch). One-shot 11-05.
- [slang#13737 — HLSL combined-sampler `Load`/`GetDimensions` extra sampler arg](13737-hlsl-combined-sampler-texture-only-ops.md) —
  DRAFT PR #13741 R4 APPROVE; CI waits on `falcor-ci`, ready flip = operator. Owns follow-ups #14123–#14126 + #14041 (no dispatch on their webhooks). Re-check 11-07.
  - [Dated history](13737-hlsl-combined-sampler-history.md)
- [slang#13766 — WGSL pack_clamp_u8(int4) negative lane → 255](13766-wgsl-pack-clamp-u8-negative-lane.md) —
  **CLOSED 10-22** by reporter PR #13775. Operator item: whether to file the D3DCOLORtoUBYTE4 WGSL finding.
- [slang#13739 — WGSL/Metal BAB Load<T> keeps dead word loads](13739-wgsl-metal-bab-struct-load-dead-word-loads.md) —
  fix A via reporter PR #13764 (triager-verified); waiting on maintainer CI approval + review; no fixer. Spin-wait side note unfiled (operator).
- [slang#13768 — WGSL tier1/tier2 storage-texture formats + E56106](13768-wgsl-storage-texture-tier1-tier2-formats.md) —
  part 1 = DRAFT PR #13778 (R1 AWN applied), HELD in draft (operator never answered the ready flip). Part 2 (E56106 B1–B4) parked on zangold-nv/expipiplus1. Last re-check `t-79c65a` 10-30.
- [slang#13732 — WGSL member subscript copies whole uniform struct](13732-wgsl-uniform-member-subscript-whole-struct-copy.md) —
  human WGSL perf regression, P2; fix = reporter PR #13734 (no fixer). PARKED on jkwak-work review; re-check `rechase-13732-pr13734-cb-7fd5` 11-01 15:00Z. storeCoherent side find unfiled (operator).
- [slang#13690 — Metal RayQuery → `intersector<>` lowering?](13690-metal-rayquery-intersector.md) —
  human Metal design question, Feature/P3. PARKED on kaizhangNV; no fixer. Sibling #13688.
- [slang#13642 — slang-wasm `createSession` macros/search paths/options](13642-slang-wasm-createsession-options.md) —
  **TERMINAL, closed 10-23.** Reporter's PR #13651 (C++-shaped `SessionDesc` with `targets[]`, per jkwak-work) was merged by jkwak-work as d36f0be181.
- [slang#13662 — slang-wasm `loadModuleFromIRBlob` + `Module.serialize`](13662-slang-wasm-load-module-ir-blob.md) —
  human-filed (albertrodriguezclo) feature request: wasm offers only `loadModuleFromSource`. Triaged 10-15 17:14Z Feature/P3; dup of older #8744. Reporter PR #13663 is the fix (watch-only, fork-CI action_required); issue post held for operator GO; re-check t-ea7eeb 10-22.
- [slang#13673 — `sign` in `slang.numerics` (`ISignedNumeric.IntegerSign`)](13673-numerics-sign-requirement.md) —
  tangent-vector feature proposal, self-assigned. TRIAGED 10-16 (cmt 6210602589), P2; PARKED on tangent-vector, fixer HELD (design-RFC). Prereq: int-matrix conformances; CoopVec lacks core `sign`. Triager re-check t-6d276c 10-23.
- [slang#13676 — SPIR-V `float(sign(x))` redundant FToS→SToF round-trip](13676-spirv-sign-float-int-float-roundtrip.md) —
  P3, human-owned (tangent-vector self-assigned 10-21, GoodFirstBug). GLSL `sign`→int bug unfiled (operator). Final triager re-check `t-aea473` 11-05.
- [slang#13664 — `getBuiltinModuleSource` null-deref without embedded source](13664-getbuiltinmodulesource-null-without-embedded-source.md) —
  TERMINAL: reporter PR #13665 merged 10-26, issue closed. Follow-up B (empty-source compile) and the language-server note are unfiled (operator call).
- [slang#13635 cluster — WGSL NaN/Inf const-expressions Tint rejects](13635-wgsl-nonfinite-const-expr-cluster.md) —
  reporter PR #13645 rejected. Bot drafts #13816 (on #13669), #13670 (HOLD), #13669, #13680 await operator un-draft; #13671, #13682 parked; doc-regen #13821.
- [slang#13639 — WGSL push constants as `var<immediate>`](13639-wgsl-push-constant-immediate.md) —
  fixed by reporter PR #13646 (MERGED 10-21), issue closed. Only open item: operator go/leave-it on the stale-line edit in cmt 6193417129; no re-arm. Follow-on #13666 → slang-triager; side segfault #13656 filed, unrouted.
- [slang#13640 — WGSL `diagnostic(...)` directive emission](13640-wgsl-diagnostic-directive.md) —
  human feature request, P2 (rec A: a compiler option). HANDED OFF to reporter PR #13660 and jkwak-work; re-check 10-27 (no change). Side bugs #14244 (`-Xtint` dropped) + #14245 (`-Xglslang` dropped) filed 11-03, filed-only.
- [slang#13617 — WGSL fragment `SV_PrimitiveID`](13617-wgsl-fragment-primitive-id.md) —
  human feature request (rhendry), P2; DRAFT PR #13619 (Approach A), jkwak-work assigned. PARKED on maintainer + ready-flip (weekly list); re-chase `rechase-13617-primitive-0dd5` 11-06 10:30Z. [Re-chase log](13617-wgsl-fragment-primitive-id-rechase-log.md).
- [slang#13590 — WGSL emits `bool` members in `var<uniform>` structs](13590-wgsl-bool-uniform-host-shareable.md) —
  human-filed (j8asic) WGSL bool not lowered to int in host-shareable address spaces; P2. DRAFT PR #13607 (R1 APPROVE_WITH_NITS applied). **PARKED** 10-16 in the parked-chain register on kaizhangNV/jkwak-work review + CI approval. 2 follow-ups unfiled (operator).
- [slang#13571 — WGSL matrix negation emitted as `matNxM<f32>(0) - m`](13571-wgsl-matrix-negation.md) —
  human WGSL emit bug, P2; draft PR #13572 @5be2d78f1b (#14179 folded in, local until 11-06) awaits jkwak-work. Follow-ups #14184–#14188 belong to this chain (no dispatch); #14184 claimed by a human. Detail in the record.
  - [Dated history](13571-wgsl-matrix-negation-history.md)
- [slang#14179 — WGSL vector negation loses -0.0](14179-wgsl-vector-negation-signed-zero.md) —
  human WGSL emit bug, P2; folded into #13572 (decided 11-02); R6 hold to 11-06 12:21Z, triager post t-c47654 12:30Z.
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
  bot-filed 11-03 from the #14133 chain (G1 regression from merged #14150); **its `issue_opened` belongs to #14133, do not dispatch.** Fixer chain on `gh-issue-shader-slang/slang-14238`; draft PR **#14267** (folds to a constant). **11-04 19:05Z: jhelferty-nv asked for a per-thread dynamic calculation instead**, so it is being reworked through a fresh triager session, and the ready-flip ask is moot. Detail in the record.
- slang#14330: CUDA vector arithmetic in a global `static const` array gives a ptx dynamic init. Bot-filed 11-04, a side find of #14267 R2; filed-only, not a regression, related to #13444. **Its `issue_opened` belongs to the #14238 chain, so do not dispatch it.** Detail in the [#14238 record](14238-int-div-forceinline-global-const-regression.md).
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
  draft PR #13564 PARKED on maintainers (breaking?) + operator (ready). ⚠️ Drafts #13425/#13872 also claim stable id 910/max 38; whichever merges second renumbers. Re-chase `rechase-13564-decisions-5727` 11-05.

- [slang#13556 — CUDA/PTX `SampleGrad` via `tex*Grad`](13556-cuda-samplegrad.md) —
  **MERGED 2026-10-15** (#13559, combined-sampler only; separate-sampler stays E36107 per jkwak-work). Possible unfiled follow-up: separate-sampler `Sample`/`SampleLevel` on CUDA.
- [slang#13544 — C++14 `'` digit separators](13544-digit-separators.md) —
  CLOSED 10-13 (completed). Drafts #13547 (float `_`, blocked by skiminki-nv) and #13546 (`#if`, `Fixes #13545`) still live; CI waits on falcor-ci. PARKED on an inbound; no further re-chase.
  - [#13544 triage, drafts, maintainer rounds and close (history)](13544-history-triage-to-close.md)

- [slangpy#1214: SlangPy Tests red on every Slang PR since slangpy#1199](slangpy-1214-cuda-cap-ci-latest-slang.md) —
  **an outage of a required check that blocks all Slang merges.** The one-line fix is in slangpy `ci-latest-slang.yml` and belongs to the maintainers. Escalated to the operator 10-08.

- [slang#13536 — add `RTexture*`, warn on `readonly`/`writeonly` on `RWTexture*`](13536-rtexture-deprecate-readonly-rwtexture.md) —
  maintainer feature (step 1 of 2), P2. Fixer HELD on the author's HLSL choice (reject vs lower with loss); silent through 4 re-chases; next `rechase-13536-hlsl-choic-bf55` 11-08.

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
  our gates have passed (review r2 APPROVE_WITH_NITS). Its CI run was deleted (404 as of 10-08), and only un-drafting (B) gets around the bot-dispatch throttle. Waiting on the operator's B/C/park decision; re-chased weekly since 10-12 (11 asks unanswered as of 11-02). The 11-09 re-chase is the last one: with no reply, it parks the chain with no timer.

- [slang#13298 — GCP-T4 runner dies mid-test in release-gpu-dx (pagefile)](13298-gcp-t4-runner-loss-pagefile.md) —
  CLOSED 10-22 by maintainer; 32 GiB pagefile fix held (0 recurrences post-rollout). Terminal record.
- [slang#13423 — Metal ConstantBuffer ignores ScalarDataLayout](13423-metal-cb-scalar-layout.md) —
  draft PR #13425 (r2 AWN) parked on a maintainer review / un-draft; #13386 lands first. Its stable id keeps colliding with master (last re-merge: 910 / max 37).
  - [re-chase log](13423-metal-cb-scalar-layout-rechase-log.md)

- [slang#13419 — Conditional resource loses bindings/reflection when its condition uses an extern enum](13419-extern-enum-conditional-binding.md) —
  NO-GO for the bot (the reporter is the assignee). Assignee PR #13487 is open: 1 Falcor CI failure, 5 tangent-vector inline comments unanswered. Re-chase `rechase-13419-pr13487-5716` (10-28).

- [slang#13420 — false-positive E41035 for store/read under the same condition (must-init walk is path-insensitive)](13420-uninit-correlated-conditions.md) —
  triaged + reproduced regression (#11293). jhelferty-nv assigned it to the reporter, so NO-GO and the fixer is stood down; on 10-09 the assignee opened PR #13543 (Fixes #13420), which has been open, conflicting with master and idle since 10-16 (as of 11-04); next re-chase `rechase-13420-pr13543-693b` (2026-11-11).

- [slang#13409 — Metal groupshared forwarded across barriers; sibling #13412 (all-target pointer roots)](13409-metal-groupshared-barrier-forwarding.md) —
  drafts #13421 + #13431 passed internal review; CI never ran. In the parked-chain register since 10-29; no timer.
  - [#13409/#13412 decisions, review rounds and re-chase log](13409-history-decisions-and-rechases.md)

- [slang PR #12136 — lazy autodiff builtins, fork PR approver loop](12136-lazy-autodiff-approver-loop.md) —
  R10 held (master merge only); R9 undecided because the approver session is in cost escalation. With the operator; re-chase `rechase-12136-approver-c-c050`.

- [slang#13311 / PR #13312 — nightly stale agentic tests, now 3 docs leftovers](13311-nightly-agentic-stale-tests-docs-leftovers.md) —
  superseded by maintainer #13317, then rescoped by a master merge after jkwak-work's approval was dismissed. It is non-draft and mergeable. The operator's (a)/(b)/(c) decision went unanswered for 3 rounds, so on 10-02 it was HANDED OFF to maintainer review. No re-chase is scheduled.

- [slang#13385 — HLSL `Append` of a non-default-layout matrix struct segfaults](13385-hlsl-append-matrix-layout-segfault.md) —
  draft PR #13386 (AWN) has no CI; un-draft is the operator's call. Bare-matrix gap #13388 belongs to jkwak-work, unrouted. **Parked with no timer since 11-02** after the 10th unanswered ask; "un-draft 13386" unparks it.

- [slang#13350 — glsl-module matrix `operator*`/`*=` gated off wgsl+metal (E36107)](13350-glsl-matrix-mul-wgsl-metal-gate.md) —
  ✅ TERMINAL 11-04: PR #13356 merged by jkwak-work (f0660607f1), issue closed COMPLETED. Follow-ups #13355 + #13359 HOLD on jkwak-work.
  Re-chase `rechase-13350-13355-r8-6fd2` (2026-11-07, follow-ups only); dated entries in [re-chase log](13350-glsl-matrix-mul-rechase-log.md).
- [slang#13041 — verify-documented-compiler-version.sh exit 4 (windows-aarch64); bot fix #13042 incomplete](13041-verify-compiler-version-exit4.md) —
  three post-fix hits (two in merge_group, 09-28/29, plus #11709 on 09-30). Diagnostic draft #13352 is waiting on the operator ready-flip and on jvepsalainen-nv choosing exit semantics; re-chase `rechase-13352-exit-seman-440c` (10-03).

- [slang PR #11709 — groupshared parameters by reference](11709-groupshared-param-by-reference.md) —
  MAINTAINER-DRIVEN since 10-28 (jhelferty-nv's rework); the bot stands down unless asked, including on her follow-up #14094. Cleanup #14105 was bot-filed (needs no dispatch). #13406 rounds: [11709-13406-ref-split-review-rounds.md](11709-13406-ref-split-review-rounds.md).

- [slang#13348 — inherited field through a property/subscript BoundStorage → E99997 ICE](13348-inherited-field-boundstorage-ice.md) —
  triaged + reproduced; three BoundMember consumers accept VarDecl only and reject InheritanceDecl. The author
  self-assigned it, so NO-GO and no fixer; silent at the 10-07, 10-14, 10-21, 10-28 and 11-04 re-chases; next `rechase-13348-assignee-4622` (2026-11-11).

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
- [slang#13549 — bump pinned LLVM to drop the ARM COFF patch](13549-llvm-pin-coff-patch.md) — OPEN; llvm/llvm-project#229712 merged 10-26 but is in no LLVM release yet; maintainer-owned (jkwak-work); one-shot re-chase `rechase-slang-13549-r1-a169` 11-06 09:00Z
- [slang#13565 — SemanticChecking compile-time step since 10-07](13565-semcheck-compile-perf-step.md) — OPEN, maintainer-owned (jvepsalainen-nv), silent; re-measure from absolute daily medians. Re-chase `rechase-13565-r5-a966`.

- [slang#13793 — member typealias caps don't reach enclosing struct](13793-member-typealias-capability-propagation.md) —
  TERMINAL: superseded by kaizhangNV's PR #13798; design question held with tangent-vector/skiminki-nv. Lesson: check the timeline for a reporter PR before dispatching a fixer.
- [slang#13387 — whole-helper specialization per conformance](13387-helper-per-conformance.md) —
  fork PR by jvepsalainen-nv; 10-24 saipraveenb25 asked the bot for an extension-based rework. The fixer's proposal is on slang-coworkers fix/issue-13387 (8c5bb99, 11 commits). Parked on Q1–Q5 to saipraveenb25; re-check task slang-13387-maintainer-r-c5d6 runs 10-27.
- [slang#14038 — `a -= b` not synthesized from user `operator-`](14038-compound-assignment-from-binary-operator.md) — human-filed 10-29; feature/P3, rec A (diagnostic note); 11-03 reporter opened option-A PR #14246 (skiminki-nv APPROVED); 11-04 tangent-vector rejects synthesis/attribute, points to slang.numerics IAdditive; report-only; 11-04 #14246 skiminki-nv APPROVED, approver event queued (paused); re-check i14038-recheck-df24 11-09 17:15Z
- [slang#14033 — `-target cuh` host header](14033-target-cuh-host-header.md) — draft PR #14197 (sub-bug A) peer-approved 11-02; waits on a human `gh pr ready` + jkwak-work review; B–D parked; re-check recheck-14197-ready-revi-40e1 11-05 18:00Z
- [slang#14200 — body-less `__extern_cpp` entry point ICE](14200-bodyless-extern-cpp-entry.md) — draft PR #14202 Fix Report 11-03 (head 32859719b), parked on operator ready flip; G2 = #14213 (filed-only)
- [slangpy#1250 — pyright/nodeenv breaks ci-latest-slang](slangpy-1250-pyright-nodeenv-alpha-index.md) — bot-filed 10-30; "SlangPy Tests" red on every Slang PR since 10-29 22:13Z (infra, not PR); **CLOSED 10-30 13:49Z** by maintainer PR slangpy#1253 (`pyright[nodejs]`); bot #1251 closed unmerged; Slang-side reruns left to babysitter
- [slang#11550 — synthesized-init debug info, merged fix disputed](11550-synthesized-init-debug-info-dispute.md) — bot PR #11555 merged 06-26; 10-30 tangent-vector says the old behavior is "not a bug"; reporter pdeayton-nv asked for a FlagArtificial tracking issue; triager filed **#14107** 10-30 21:40Z; terminal for the bot (re-check cancelled); 11-02 #14107 assigned to kaizhangNV (human-to-human question, no bot action)
- [slang#14100 — float3→float user implicit conversion builds `vector<vector<float,3>,4>`](14100-implicit-conversion-nested-vector.md) — human-filed (pdeayton-nv, `bot-ok`); draft PR #14110 PARKED on maintainer review + un-draft, re-check `recheck-14110-maintainer-1369` 11-03 15:00Z; bot-filed #14109, #14116, #14117 owned here (no dispatch). Detail in the record.
- [slang#14099 — HLSL sibling `for (int i…)` loops conflict](slang-14099-hlsl-sibling-for-loop-redecl.md) —
  approach B (tangent-vector, `pr: breaking change`); draft PR #14115 (AWN applied) parked on the operator un-draft (dashboard msgs 147/191). Re-check #1 11-02 unchanged; final re-check `recheck-14115-ready-2-3f50` 11-05 17:00Z.
- [slang#14118 — unbraced if/else/while/do body local visible before its declaration](slang-14118-unbraced-body-local-visible-early.md) —
  bot-filed follow-up of #14099, **owned by that chain** (no dispatch on its issue_opened). Medium/P2; draft PR #14119 R2 APPROVE_WITH_NITS. ⛔ **BLOCKED 11-03 by skiminki-nv** on the #12266 maintainer discussion. Competing maintainer PR #12389 (approach C, breaking) says Fixes #14118. #14119 parked; un-draft ask withdrawn.
- [slang#14120 — locals visible before declaration in `__target_switch` case / unbraced `catch` / unbraced `$for` body](slang-14120-target-switch-catch-for-local-visible-early.md) —
  bot-filed follow-up #2 of #14099, **owned by that chain** (no dispatch). P3; parked until #14119 lands or a maintainer picks; final re-check `recheck-14115-ready-2-3f50` 11-05 17:00Z.
- [slang-rhi#961 — Metal/CUDA dispatch-time thread-group size + `dispatchThreads`](slang-rhi-961-dispatch-time-threadgroup-size.md) — human feature request 11-01, host side of slang#14136; feature/P2. PARKED on maintainer API direction; R6 to 11-05, triager one-shot t-b6e981. Owns bot #14143 (no dispatch): jkwak-work self-assigned it 11-02 (Q1 2027), fixer ask withdrawn 11-03; rhi-hardening filing is an open file/skip ask, no timer.
- [slang-rhi#962 — Metal timestamp queries not implemented](slang-rhi-962-metal-timestamp-queries.md) — human feature request 11-01; feature/medium/P2. **Reporter PR #963 implements it.** PARKED on a maintainer pick; R6 to 11-05, triager one-shot t-bf3f6d; no fixer without the operator.
- [slang-rhi#964 — Metal compute pass costs 16-30 us (per-encoder queue-fence wait/update)](slang-rhi-964-metal-compute-pass-fence-cost.md) — human perf report 11-01 (cloth-sim batch with #961/#962); perf/medium/P2, rec A, lands after reporter PR #963. PARKED on a maintainer pick; R6 to 11-05, triager one-shot t-46390d; a fixer needs the operator and a Metal machine.
- [slang-rhi#943 — `[SpecializationConstant]` reads 0 instead of its default on D3D11/D3D12/CUDA/CPU](rhi-943-specialization-constant-default.md) — confirmed bug, parked on a maintainer direction pick (assignee jkwak-work since 10-26; #942 merged 10-29 with tests limited to Vulkan/Metal/WGPU). No fixer dispatch; triager one-shot t-7aa5f5 11-08 13:00Z
- [slang#14135 — CUDA `__launch_bounds__` / `__maxnreg__` attribute](slang-14135-cuda-launch-bounds-maxnreg.md) — human feature request 11-01, triaged medium/P2. **Parked** for maintainer direction under R6 (to 11-05 14:29Z; one-shot t-422839 11-05 14:35Z). Reporter PR #14149 (`Fixes #14135`) is open. Fixer chain needs the operator's go-ahead.
- [slang#14137 — unknown `-entry` name prints an empty E30015 before E38000](14137-entry-unknown-name-empty-e30015.md) — human bug 11-01, Bug/low/P3. **Deferred 11-02 to reporter PR #14147**; D2/B1 split to #14193. One-shot `i14137-r6-post-a7ff` (11-05 14:35Z) records state only; a close-unmerged comes back to Main.
- [slang#14138 — CUDA no-alias (`__restrict__`) pointer spelling](14138-cuda-restrict-pointer.md) —
  human feature request 11-01, P2. PARKED: R6 to 11-05 (`r6-release-14138-c527`) + maintainer surface pick; the reporter volunteered to implement, so no bot fixer. Owns bot #14139 (no dispatch).
- [slang#14141 — Metal read-only pointers always `T device*` (want `constant`)](14141-metal-readonly-pointer-constant-address-space.md) — human perf/feature request 11-01; feature/medium/P2, rec B (opt-in `AddressSpace.Constant`). PARKED: R6 to 11-05 (`r6-release-14141-cfb7`). Owns bot #14142 (no dispatch).
- [slang#14144 — CUDA `ImmutablePtr` pointer-typed loads skip `__ldg`](14144-cuda-immutable-ptr-pointer-ldg.md) — human perf report 11-01; enhancement/low/P3, rec A. PARKED: R6 to 11-05 (`r6-release-14144-eb4e`) + operator/csyonghe call. Owns bot #14145, #14146 (no dispatch).
- [slang#14159 — Metal BFloat16/FP8 emit undeclared `*Type` names](14159-metal-bfloat16-fp8-undeclared-types.md) — human bug (albertrodriguezclo) 11-02. Triaged Bug/medium/P2 (`cuda_sm_*` [require] aliases are cross-target). Triage comment 6648117016 posted 11-05 02:34Z. PARKED on maintainer (jkwak-work): BFloat16-on-Metal + HLSL SM 6.10 FP8 coop-mat; reporter owns the PR, no bot fixer.
- [slang#14158 — Metal `half` NaN/Inf literal emitted as float `(1.0 / 0.0)`](14158-metal-half-nonfinite-literal.md) — human bug (albertrodriguezclo) 11-02 10:04Z; reporter has a fix prepared (expect own PR). Triaged Bug/medium/P2, rec A (reporter fix). PARKED: R6 to 11-06 10:04Z, triager one-shot t-03c361 11-06 10:10Z; no bot fixer. Owns bot HLSL twin #14161 (filed-only, no dispatch).
- [slang#14212 — `-incomplete-library -target spirv` segfault on `extern` call inside a loop](14212-spirv-incomplete-library-extern-call-in-loop-crash.md) — human bug, Bug/high/P2; root cause in SPIRV-Tools. Draft PR #14220, R1 remedy applied: awaiting human review + ready flip. OPEN: operator go-ahead on SPIRV-Tools filing. Owns #14223–#14226 (#14225 closed WNF 11-04: `&` to be deprecated).
- [slang#14215 — proposal: `-validate-with-downstream-compiler` for SIMPLE text-target tests](14215-validate-with-downstream-compiler.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 00:32Z. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14258 — tests: `CHECK-NOT: error NNNNN` lines never match](14258-check-not-old-error-format.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 21:34Z. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14265 — tests: remove dead `*.expected` files (filecheck=/diag=/disabled)](14265-dead-expected-files.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 22:00Z. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14266 — slang-test: `diag=` tests ignore the slangc exit code](14266-diag-tests-exit-code.md) — maintainer (jkwak-work) self-filed + self-assigned 11-03 22:03Z. HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14292 — slang-test: exit-code check in all test types, not only SIMPLE](14292-slang-test-exit-code-all-test-types.md) — maintainer (jkwak-work) self-filed + self-assigned 11-04 03:42Z, part of #14215 (umbrella over #14266). HELD: no dispatch, no bot post; resume on an @nv-slang-bot mention or operator ask.
- [slang#14249 — GLSL subgroup functions lack HLSL/CUDA impls (shader-subgroup tests disabled)](14249-glsl-subgroup-hlsl-cuda-gap.md) — human bug (jkwak-work, self-filed + self-assigned) 11-03 18:45Z. TRIAGED bug/medium/P2 (cmt 6613400566). PARKED on the assignee, fixer NO-GO; re-check recheck-14249-assignee-c5f7 11-10.
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
- [slang#14260 — GLSL texture functions do not all compile for HLSL (intrinsic-texture.slang)](14260-glsl-texture-funcs-hlsl-gap.md) — human bug (jkwak-work, self-filed + self-assigned) 11-03 21:46Z. TRIAGED P2 (cmt 6616981515; 11-04 delta 6636414885 asks test shape + bot PR); idle on assignee, fixer NO-GO. Split-offs **#14271** (4-offset Gather, HLSL) and **#14272** (SM floors) FILED-ONLY.
- [slang#14259 — HLSL constant `double` `RWByteAddressBuffer.Store` emits untyped `.Store(` → DXC f32 store](14259-hlsl-byte-address-store-double-untyped.md) — human bug (tdavidovicNV) 11-03 21:35Z. TRIAGED bug/high/P2 (cmt 6616391526), emit-layer root cause. RESOLVED 11-04 01:48Z: DRAFT PR #14276 @ 860cc7501 (peer R2 approve-with-nits); ready-flip pending. Side-finds #14282/#14283 filed-only. 11-04 19:10Z maintainer skiminki-nv asked for an alternative `L`-suffix PR → DRAFT #14322 (fixes repro; not half/inf/CUDA). Parked on skiminki-nv: #14322 vs #14276 (timer 11-11). Side-find S3 #14323 (FXC double BAB).
- [slang#14277 — GLSL two undeclared `local_size_*_id` → E99997 ICE (slang-check-modifier.cpp:2317)](14277-glsl-local-size-id-undeclared-constant-id-ice.md) — bot-filed 11-03, #14256 side-find (owned by that chain; no dispatch). DRAFT PR #14284 (peer R2), ready-flip pending.
- [slang#14282 — HLSL ROV `RasterizerOrderedByteAddressBuffer.Load<T>` emitted as `.Load<T >`, DXC rejects](14282-hlsl-rov-bab-templated-load-dxc-reject.md) — bot-filed 11-04 00:39Z by slang-triager, side-find S1 of slang-reviewer's R1 on PR #14276 (#14259 chain). Bug + `reproduced`. issue_opened needs NO dispatch; FILED-ONLY until #14276 lands (one-shot `recheck-14282-pr14276-51f9`, 11-09).
- [slang#14283 — CPU/CUDA `RWByteAddressBuffer.Store<bool>` writes 1 byte instead of 4](14283-cpu-cuda-bab-store-bool-one-byte.md) — bot-filed 11-04 00:39Z by slang-triager, side-find S2 of slang-reviewer's R1 on PR #14276 (#14259 chain). Bug + `reproduced`. issue_opened needs NO dispatch; FILED-ONLY (fixer loaded).
- [slang#14323 — HLSL SM 5.0 (FXC) `double` byte-address Load/Store emits uint64 / templated calls](14323-hlsl-sm5-double-byte-address-uint64.md) — bot-filed 11-04 21:40Z by slang-triager, side-find S3 of slang-reviewer's R1 on PR #14322 (#14259 chain). Bug + `reproduced`. issue_opened needs NO dispatch; FILED-ONLY until a #14259 PR lands (one-shot `recheck-14323-after-1425-4d9c`, 11-11).
- [slang#14327 — generic `sizeof(T)` T=bool gives 4, concrete `sizeof(bool)` gives 1](14327-generic-sizeof-bool-4-vs-concrete-1.md) — bot-filed 11-04 22:28Z by slang-triager, side-find of the #14157 bool-size answer (with docs/comment drift). Bug + `reproduced`. issue_opened needs NO dispatch; FILED-ONLY pending a maintainer 1-vs-4 decision. Siblings #14328 (host-cpp ICE) / #14329 (llvm-host-ir) same batch, also no dispatch.
- [slang#14302 — slangc: dedicated exit code (-2) for internal compiler errors](14302-ice-dedicated-exit-code.md) — human (jkwak-work) 11-04 06:45Z, assigned to author by jhelferty-nv; author's own fix PR #14303 (non-draft) up 33 s later. NO DISPATCH: maintainer-driving.
- [slang#14286 — slang-test does not find the Metal compiler on Windows when it is on PATH](14286-metal-compiler-windows-path.md) — human bug (jkwak-work, self-filed + self-assigned) 11-04. Author's own fix PR #14287 open (non-draft). NO DISPATCH: maintainer-driving.
- slang#14288 / #14289 (GLSL `local_size_x_id` default lost in GLSL emit / one `layout(...)` keeps only the last size-or-id per axis) — bot-filed 11-04 ~02:45Z, the #14277 reviewer's side-finds. FILED-ONLY, owned by the [#14277 chain](14277-glsl-local-size-id-undeclared-constant-id-ice.md); their issue_opened webhooks need NO dispatch.
- [slang#14304 — SPIR-V matrix `[i][j]`/`._mij` reportedly reads row 0](14304-spirv-matrix-row-indexing-not-reproduced.md) — human (JackOfBlades232) 11-04 09:45Z → slang-triager. NOT reproduced on L40S (codegen correct, full shader bit-identical under both layouts); TERMINAL 11-04: reporter withdrew + self-closed (RenderDoc debugger replay suspected). Optional RenderDoc upstream filing = operator FYI, default not filed.
- [slangpy#1260 — PyTorch bridge rejects torch.bfloat16](slangpy-1260-torch-bfloat16-dtype.md) — human (tekintatar) 11-04 22:35Z; dispatch lost to gateway 500s, re-dispatched 11-05 00:18Z → slangpy-triager (reproduced, Approach A) → slangpy-fixer, draft PR #1261 (01:25Z), R2 APPROVE 02:49Z @bee91422, CI green → READY-FLIP PENDING (weekly list). Side-finds: cursor_utils.h OOB (fixer, own PR); half-autograd Vulkan segfault → filed slangpy#1262; bf16 SPIR-V rounding → slang-triager (side-find thread). Their issue_opened webhooks need NO dispatch.
- [slangpy#1262 — Vulkan half-input bwds crashes without atomic_half](slangpy-1262-vulkan-half-bwds-atomic-half-segfault.md) — bot-filed 11-05 02:22Z by slangpy-triager, side-find of the #1261 R1 review (#1260 chain). issue_opened needs NO dispatch; fixer via triager handoff 02:25Z.
