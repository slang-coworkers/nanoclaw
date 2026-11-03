---
type: triage
title: "Triage: shader-slang/slang#14177 — render-test untyped new{} writes conformance ID from slang-rhi's device session"
description: Reproduced cpu/vk/cuda at 6815ed82d. Bug in the test harness (render-test, plus a slang-rhi API gap), not the compiler. 4 existing tests pass only by declaration-order coincidence, and so does #14176's test.
---
# Triage: shader-slang/slang#14177 — render-test: untyped `new{...}` input gets the conformance ID from slang-rhi's device session
Date: 2026-11-02 | bug | medium | P2 | test infrastructure (render-test) + slang-rhi | Duplicate: no | Regression: no indicator
Reporter: albertrodriguezclo (CONTRIBUTOR, external). R6 hold until 2026-11-06T12:06:54Z (no GitHub writes until then).

## What's broken
An interface field filled through an untyped object input (`//TEST_INPUT:set gParams = new{ foo: new ImplA{v:5} }`) gets its
witness sequential ID from slang-rhi's DEVICE session. That session's Linkage has never seen the program, so it assigns IDs
0,1,… per interface in input order. The compiler numbers IDs in linked-IR global-inst order in the program session. When the two
orders differ, dispatch silently runs the wrong conformer.

## Repro (verified, master 6815ed82d = origin/master, Debug build, L40S)
Files: `/workspace/agent/slang/tests/scratch-14177/{dispatch-id-order,named-outer,control-impla}.slang` (cpu+vk+cuda lanes).
`./build/Debug/bin/slang-test -bindir build/Debug/bin/ tests/scratch-14177/` (run from the slang repo root)
- dispatch-id-order (untyped, shader builds ImplB): **10 14 on cpu, vk and cuda** (expected 5 14). FAIL on all 3 lanes.
- named-outer (`new Params{...}`): 5 14 on all 3 lanes. PASS.  control-impla (shader builds ImplA): 5 7 on all 3. PASS.

## Codebase digest (verified file:line)
- `tools/render-test/render-test-main.cpp:784` `assignObject`: the typed branch uses `createShaderObject(slangSession(), type, None, …)`
  (:794-799). The untyped branch takes the dst cursor's type layout (the element layout for CB/PB) and calls
  `createShaderObjectFromTypeLayout(layout, …)` (:801-824). `slangSession()` = `slangComponent->getSession()` (:321). The program
  is compiled in render-test's OWN session (`slang-support.cpp:293-295`), which is not the device session.
- `external/slang-rhi/src/device.cpp:813-827`: `createShaderObjectFromTypeLayout` → `createShaderObjectLayout(m_slangContext.session, …)`.
  This is the device session. `createShaderObject(ISession*,…)` (:796-811) uses the passed session and stores it as
  `m_slangSession` (:1171).
- `external/slang-rhi/src/shader-object.cpp:778/805-807`: `setExistentialHeader` →
  `m_layout->m_slangSession->getTypeConformanceWitnessSequentialID(...)`. Called from `setObject` :182 (StructuredBuffer element)
  and :226 (existential field). Sub-layouts inherit the parent's session. Root layouts use the program session, so root-level
  interface globals are NOT affected. Also on the device session: `specializeType` :714 (its result reaches :182) and
  `getDynamicType` :651/:769 (shared AST type, probably harmless).
- `source/slang/slang-session.cpp:842-879` `Linkage::getTypeConformanceWitnessSequentialID`: per-Linkage maps
  (`slang-session.h:261/264`). On a miss it allocates from a per-interface counter that starts at 0.
  `slang-ir-lower-dynamic-dispatch-insts.cpp:1003` `ensureWitnessTableSequentialIDs` uses the compile linkage
  (`slang-emit.cpp:1764`). DeepWiki agrees: the IDs are per-ISession state, and querying one from another session is invalid.
- slang-rhi upstream `origin/main` 30250fa (2026-10-30, 58 commits past the b856e6350 pin) has NOT changed
  `createShaderObjectFromTypeLayout`, `setExistentialHeader` or the signature (`include/slang-rhi.h:3794`, now :3971). No overload
  takes a session or component type. slang-rhi #811 (merged 2026-08-10, before the pin) rejected passing `IComponentType*`
  through this API as "an ABI break". slang-rhi #838 notes that "the reflected type may originate from another session"
  (sub-object layouts only). No slang-rhi issue or PR covers conformance IDs.
- The same flaw exists in legacy `tools/gfx/renderer-shared.cpp:683-690/:1003` (render-test does not use it). SlangPy/sgl
  `Device::create_shader_object(type_layout)` (`slangpy src/sgl/device/device.cpp:924-933`) calls the same slang-rhi API, while sgl
  compiles in its own `m_slang_session`. HYPOTHESIS: SlangPy objects built from type layouts that hold interface fields have the
  same hazard. Not run.

## Tests that pass only by coincidence (verified on the cpu lane: swapping the conformer declaration order makes them FAIL; the typed `new X{}` form with the swap passes)
- `tests/language-feature/dynamic-dispatch/global-interface-param-compute.slang` (swap → 10 7, expects 5 14)
- `tests/language-feature/dynamic-dispatch/constantbuffer-struct-interface-array.slang` (swap → wrong dispatch + OOB garbage)
- `tests/language-feature/dynamic-dispatch/constantbuffer-struct-interface-field.slang` (swap → 30 8 10 4, expects 15 16 5 8)
- `tests/language-feature/dynamic-dispatch/parameterblock-struct-interface-field.slang` (swap → 114 4 3 21, expects 107 2 6 15)
- Latent (one conformer today): `global-interface-param-compute-mono.slang` (an unused decoy declared earlier → -1000);
  `tests/compute/array-existential-parameter.slang` (cannot test: adding any second conformer breaks the CPU C++ build with
  `no matching function for call to 'MyImpl_run_0'`, AnyValue4* vs MyImpl_0*. This is a SEPARATE bug, not reported upstream yet).
- None of these are disabled. Of the 9 files that use untyped `new{`, 6 touch existentials. Scratch copies are in `tests/scratch-14177/coinc/`.
- **PR #14176** (same reporter, Fixes #14152): `inout-interface-struct-field.slang` uses UNTYPED `new{ foo: new ImplA… }` /
  `new{ foo: new ImplB… }`, with ImplA declared first and no concrete construction in the shader, so it is coincidental too. By-value
  reductions on master (`tests/scratch-14177/pr14176-byval/`): with the swapped order, untyped gives 10 4 30 2 10 4 30 5 (wrong) and
  typed gives the correct 5 8 15 2 5 8 6 28. It does NOT rely on the typed-form workaround, and it is not broken today. The PR's
  entry-point test pins IDs with `-conformance` and is unaffected. Side observation (not investigated): the vk lane of those by-value
  reductions read the payload and `scale` as 0 in all 4 variants.

## Candidate approaches
### A: render-test uses the program session for untyped objects (slang-only)
- Where: `tools/render-test/render-test-main.cpp:801-824`. Replace `createShaderObjectFromTypeLayout(slangTypeLayout, …)` with
  `createShaderObject(<program session>, slangTypeLayout->getType(), ShaderObjectContainerType::None, …)`, the path the typed form uses.
- Delta: the layout is re-derived by `session->getTypeLayout(type)` in the program's session, so the IDs match the compiler.
- Tradeoffs: small and local to the test harness, and it uses an existing API. It does not fix SlangPy or other slang-rhi users.
  Re-deriving the layout could differ from the program's specialized layout. A std140-sensitive probe (`float a[2]; float3 c; int b`
  in `ConstantBuffer<S>`) matched on cpu/vk/cuda (`tests/scratch-14177/layout/`), and the 4 coincidental tests pass typed.
- Risk: in DXC/FXC pass-through, `slangComponent` = `out.slangProgram` comes from the downstream compile and may be null
  (`slang-support.cpp:637-645`). Take the session from the component that produced the reflection (`desc.slangGlobalScope`), or
  check that this is safe. The typed path already has the same exposure.
### B: slang-rhi carries the owning session for type-layout objects (root cause, external repo)
- Where: slang-rhi `include/slang-rhi.h:3794` / `src/device.cpp:813` (+ `shader-object.cpp:714`). Add a session-taking variant
  (append-only), where null falls back to the device session, and store it as `m_slangSession`. render-test and sgl then pass their session.
- Tradeoffs: fixes every client, SlangPy included. Needs a slang-rhi PR and a submodule bump. #811 shows maintainers resist changing
  this API. Needs operator go-ahead to file (no external filing from triage).
### C: Slang API hardening, a complement and not the fix
- Where: `source/slang/slang-session.cpp:842`. Detect a `TypeReflection` whose module belongs to a different Linkage and fail
  loudly (or forward to the owning linkage).
- Tradeoffs: turns silent wrong dispatch into an error for every misusing caller. The fail-loud variant breaks current callers
  until A/B land. Forwarding is a public-API behaviour change that hides caller misuse. Core-module types need care.

## Recommended path (solution brief)
- **Hypothesis:** the untyped branch of `assignObject` builds its object layout on slang-rhi's device session, so
  `setExistentialHeader` writes a sequential ID from a Linkage that never compiled the program.
- **Suspected files:** `tools/render-test/render-test-main.cpp:801-824` (fix site); context `external/slang-rhi/src/device.cpp:813`,
  `shader-object.cpp:806`.
- **Repro:** `./build/Debug/bin/slang-test -bindir build/Debug/bin/ tests/scratch-14177/dispatch-id-order.slang` (10 instead of 5 on cpu/vk/cuda).
- **Acceptance:** (1) the regression test `tests/language-feature/dynamic-dispatch/dispatch-id-order.slang` (the issue's repro, lanes cpu+vk+cuda)
  gives 5 14. (2) Declaration-swapped copies of the 4 coincidental tests pass (one of them can become the regression test). (3) No new
  failures in a full slang-test run, render-test-based tests included, on cpu/vk/cuda vs baseline. (4) Pass-through lanes (`-pass-through dxc`) still work.
- **Recommended:** A. It is a test-harness bug, the typed path already proves correct, it has the smallest blast radius, and no
  external API change is needed. Recommend B to the operator as the root-cause follow-up in slang-rhi (SlangPy exposure). C is optional hardening.
- **Routing:** the reporter often opens their own fix PR. Hold the fixer handoff until R6 release (2026-11-06T12:06:54Z); at release, hand off
  only if no reporter PR exists.

## Sources
- DeepWiki: (1) witness sequential IDs are per-Linkage, and querying from another ISession is invalid. (2) The untyped render-test
  path uses the type layout to keep specialized/element layouts (DeepWiki's rationale; unverified beyond the code).
- slang-rhi #811 (8b27c96c), #838 (959f674), upstream main 30250fa. slang PR #14176 (b13f1b30; fork CI awaiting workflow approval at 12:16Z).
- Related, not duplicates: #10893, #6924, #10797, #11266, #14152 (same reporter), #14103 (render-test DeviceCache / global session).
