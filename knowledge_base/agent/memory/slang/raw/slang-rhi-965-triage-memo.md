---
type: triage
title: "Triage: shader-slang/slang-rhi#965 — createShaderObjectFromTypeLayout uses the device session, so conformance IDs can come from the wrong session"
description: Light triage (slang-rhi half of slang#14177). Bug / medium / P2. Root cause re-verified at rhi main 30250fa. Rec (a) session-carrying variant + :714 fix; (b) docs as complement. rhi README no longer guarantees ABI. SlangPy exposure by static read only.
---
# Triage: shader-slang/slang-rhi#965
Date: 2026-11-02 | bug | medium | P2 | slang-rhi shader objects (IDevice API) | Duplicate: no (#811 related, cited by reporter) | Regression: no
Reporter: albertrodriguezclo (external; merged rhi PRs #958/#942/#929). R6 hold until 2026-11-06T12:20:47Z; main owns `r6-release-rhi-965-f9f6`.
Companion: slang#14177 ([triage-14177.md](slang-14177-triage-memo.md)) reproduced the bug through render-test on cpu/vk/cuda at rhi b856e635 (10 14 vs 5 14). Not re-run here.

## What's broken
`IDevice::createShaderObjectFromTypeLayout(typeLayout, out)` builds the layout on the device's own session. The type layout
usually comes from a program compiled in a different session. `setExistentialHeader` then asks the device session's Linkage
for the witness sequential ID; that Linkage never compiled the program, so it hands out IDs in first-query order. When that
order differs from the compiler's, dynamic dispatch runs the wrong conformer, silently.

## Codebase digest (verified at rhi origin/main 30250fa108, 2026-10-30)
- `include/slang-rhi.h:3971` virtual `createShaderObjectFromTypeLayout(TypeLayoutReflection*, IShaderObject**)` — no session param.
  Compare `:3945` virtual `createShaderObject(ISession*, TypeReflection*, container, out)` + inline session-less wrappers `:3952/:3961`.
- `src/device.cpp:745-760` → `createShaderObjectLayout(m_slangContext.session, typeLayout, …)` (:755). Uncached on purpose (#811 / slang#10893).
  `createShaderObject(session,…)` :728-743 uses the passed session (null → device session).
- `src/shader-object.cpp:25` `initBase` stores the session as `m_slangSession` (sub-layouts inherit it).
  `:806` `setExistentialHeader` → `m_layout->m_slangSession->getTypeConformanceWitnessSequentialID`; called from `setObject` :182 / :226.
- `src/shader-object.cpp:714` `getSpecializedShaderObjectType` → `m_device->m_slangContext.session->specializeType(...)` — device
  session regardless of the layout's session, so it is wrong even on the `createShaderObject(session,…)` path. `:651/:769` getDynamicType (shared, likely harmless).
- Line numbers moved vs the b856e635 pin (device.cpp:813-827 there); logic unchanged.
- Callers: slang render-test (fixed on its side by slang PR #14178), sgl `device.cpp:929`, rhi `tests/test-shader-object-from-type-layout.cpp:50/56`, debug layer `debug-device.cpp:975-989`.

## ABI / compatibility constraint (the load-bearing fact)
- IDevice is a COM-style `ISlangUnknown` vtable (`slang-rhi.h:3720`, UUID 0x311ee28b…). Changing the signature of the existing
  virtual, or inserting a virtual mid-interface, changes the vtable for binaries built against an older header.
- #811 (merged 2026-08-10, author jvepsalainen-nv, approved skallweitNV) set aside "pass the owning IComponentType*" as "an ABI break"
  — the author's own rationale, not a maintainer ruling.
- **Since #895 (2026-10-08) the rhi README "Project status and compatibility" (README.md:35-41) says neither source nor ABI
  compatibility is guaranteed; use headers and binaries from the same revision.** CONTRIBUTING.md:15-19 repeats it.
  #940 (skallweitNV, 2026-10-27) inserted `createResourceHeap` etc. mid-IDevice (:3758, before `createShaderObject`).
- So ABI is not a hard blocker under current policy. Source compatibility still matters for the callers above: keep the
  2-arg form compiling.

## Candidate approaches
### (a) Session-carrying variant (recommended)
- Where: `slang-rhi.h:3971`, `device.h:248`, `device.cpp:745`, `debug-device.{h,cpp}`, plus `shader-object.cpp:714` → `m_layout->m_slangSession`.
- Shape: mirror `createShaderObject` — virtual `createShaderObjectFromTypeLayout(slang::ISession* session, TypeLayoutReflection*, IShaderObject**)`,
  null → device session; keep the old 2-arg call as an inline wrapper passing nullptr. (Strict-ABI alternative: append a new
  virtual at the end of IDevice and leave the old one.) Header doc: the session must own `typeLayout`.
- Delta: callers that pass their session get correct IDs; existing 2-arg callers behave as today.
- Tradeoffs: small (~5 files). Needs callers to opt in (sgl, render-test). Null fallback keeps today's hazard for unchanged callers.
- Risk: `ComPtr<ISession>` on the layout extends session lifetime only — the layout stays uncached, so #811's lifetime fix holds.
### (b) Document only
- Where: header comment at `slang-rhi.h:3971` (+ docs/api.md if wanted).
- Tradeoffs: no code change; leaves sgl/SlangPy exposed and the failure stays silent. Callers that need the program's exact
  (specialized/element) layout have no correct API — `createShaderObject(session, layout->getType())` re-derives the layout.
### (c) Fail loudly (complement, Slang side)
- slang `Linkage::getTypeConformanceWitnessSequentialID` rejects a type from another Linkage. See triage-14177 Approach C. Behaviour change for all callers.

## Recommended
(a) with the :714 fix, plus (b)'s header sentence. Uncertain point: whether the maintainer wants a signature change in place
(allowed by policy) or an appended method — leave that to skallweitNV.

## SlangPy / sgl (static read only — NOT run)
- sgl `Device::create_shader_object(type_layout)` (slangpy src/sgl/device/device.cpp:924-933, slangpy ca29d81) calls this API.
- sgl gives rhi only `slangGlobalSession` (device.cpp:287); sgl programs compile in sgl's own session
  (`shader.cpp:543` `global_session()->createSession`). So the session mismatch exists. FACT.
- Python reach: `slangpy/builtin/{descriptor,value(x2),array,tensor}.py` call `create_shader_object(...uniform_layout.reflection)`.
  HYPOTHESIS: wrong dispatch happens only if code then sets an interface-typed field on such an object (setObject → setExistentialHeader). Unverified.
- Not run: no built `slangpy_ext` in this container (import fails); a SlangPy build is not cheap.

## Sources
- rhi #811, #895 (README policy), #940; slang#14177 memo; slang PR #14178 (reporter, render-test side).
- Shared learnings: CodeRabbit ABI false positive on #841 (end-appended IDevice methods are ABI-safe); render-test DeviceCache/global session (#14103).
