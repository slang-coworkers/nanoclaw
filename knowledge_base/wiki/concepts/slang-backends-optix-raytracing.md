---
title: "Slang OptiX / Ray-Tracing Backends: Payloads and Terminate Intrinsics"
type: concept
group: slang-backends
tags: [optix, cuda, ray-tracing, raypayload, paq, hlsl, dxc, payload-access-qualifiers]
source_count: 6
---

# Slang OptiX / Ray-Tracing Backends: Payloads and Terminate Intrinsics

Ray-tracing codegen in Slang spans the HLSL/DXC backend (payload access qualifiers for SM 6.7+) and the CUDA/OptiX backend (payload write-back around terminate intrinsics). This page covers the two recurring bug classes: ray-payload access qualifier (PAQ) legalization and OptiX payload loss on early ray termination.

## TL;DR
- Ray-payload access qualifiers (PAQ) are an HLSL/DXC-facing contract; emitting them wrongly silently changes payload lifetime rather than erroring.
- OptiX loses payload on early ray termination — a payload read after termination is undefined, so the fix belongs at the termination site, not at the reader.
- When a ray-tracing symptom appears in emitted code, trace it to the payload representation or an IR pass before changing the emitter.
- Tooling caveat recorded here: the PR-review runner's flag parser has its own quirks; do not infer review behaviour from a mis-parsed flag.

## Ray-Payload Access Qualifiers (PAQ) for HLSL/DXC

At SM 6.7+, DXC requires every field of a `[raypayload]` struct to carry payload access qualifiers (PAQs). Slang's frontend `checkRayPayloadStructFields` validates this only for user-declared `[raypayload]` modifiers in the AST — but a SECOND IR path stamps `IRRayPayloadDecoration` without validation. `searchChildrenForForceVarIntoStructTemporarily` calls `addRayPayloadDecoration` whenever `__forceVarIntoRayPayloadStructTemporarily` is unwrapped (for any plain struct passed to `TraceRay` without a user `[raypayload]`). The result is a struct with `IRRayPayloadDecoration` but no PAQ field decorations, which DXC rejects (#10267). Treat "has `IRRayPayloadDecoration`" as necessary-but-not-sufficient for PAQ presence; also check `IRStageReadAccessDecoration`/`IRStageWriteAccessDecoration` on each field key. Pre-SM 6.7 semantics allowed every stage to read/write every field, so the correct default is the full four-stage set `read(caller, anyhit, closesthit, miss) : write(...)` ([slang-raypayload-implicit-decoration-paq-gap](wiki/learnings/1779295178725-slang-raypayload-implicit-decoration-paq-gap.md)).

**Asymmetric skip-gap:** The fix pass `legalizeRayPayloadAccessQualifiersForHLSL` skips fields that "already carry qualifiers" via two independent `continue` checks (one for read, one for write). This leaves a hole for explicit `[raypayload]` structs with one-sided qualifiers (e.g. `[read(caller)]` but no write): the field takes the first `continue` and is emitted with the missing complement, which DXC still rejects. The frontend only errors when BOTH read and write are missing. The fix replaces the `continue`-pair with two independent `if (!find) addDecoration` calls ([slang-raypayload-paq-pass-asymmetric-skip-gap](wiki/learnings/1779297394847-slang-raypayload-paq-pass-asymmetric-skip-gap.md)).

**Coverage gap on hit-shader-only compiles:** A competing fix (PR #11224) hooks into the `__forceVarIntoRayPayloadStructTemporarily` legalize path, which only fires around `TraceRay`/`HitObject::TraceRay`/`HitObject::Invoke` payload args — never around anyhit/closesthit/miss params. So a translation unit with no `TraceRay` call (typical for per-stage compiled shader libraries) leaves one-sided PAQ structs unfixed. The structurally-correct approach (PR #11218's `legalizeRayPayloadAccessQualifiersForHLSL`) walks every `IRStructType` carrying `IRRayPayloadDecoration`. When evaluating PAQ fixes, verify they run over all `IRRayPayloadDecoration` structs, not just call-site-reached ones ([slang-10267-pr-11224-coverage-gap-anyhit-only](wiki/learnings/1779364869375-slang-10267-pr-11224-coverage-gap-anyhit-only.md)).

## OptiX Payload Loss on Early Ray Termination

For an OptiX `anyhit` shader, `AcceptHitAndEndSearch()` (→`optixTerminateRay()`) or `IgnoreHit()` (→`optixIgnoreIntersection()`) called from a nested non-inlined helper terminates the ray before the entry point writes the payload back — silent payload loss with no diagnostic (#11658).

Root cause: `emitPayloadWritebacks()` in `slang-ir-legalize-varying-params.cpp` (~line 1721) DOES insert payload write-back before shader-terminating calls, but its scan walks ONLY `m_entryPointFunc->getBlocks()`. A terminating call buried in a callee is never in the entry point's blocks, so it's missed. `[ForceInline]` works because inlining hoists the call into the entry point's blocks. This is the coverage gap of already-fixed #6326 (PR #6956 added the write-back-before-terminate logic for the direct-in-entrypoint case). Reproduce GPU-free: `slangc repro.slang -target cuda -entry any_hit -stage anyhit` and inspect that `optixSetPayload_N` sits after the call (dead code) while the terminate intrinsic is inside the callee ([slang OptiX payload lost when terminate-intrinsic is in a callee (entrypoint-local writeback scan gap)](wiki/learnings/1781777421724-slang-optix-payload-lost-when-terminate-intrinsic-.md)).

**CUDA legalizer mechanics:**
- `isShaderTerminatingIntrinsic` detects terminate intrinsics for CUDA via NAME HINT (`IgnoreHit`/`AcceptHitAndEndSearch`), because the lowered `__target_switch` cuda case emits `optixIgnoreIntersection`/`optixTerminateRay` which don't contain those substrings. Any analysis keyed on this must gate on ray-tracing stage, else a non-ray kernel calling a user func named `IgnoreHit` collides.
- `processEntryPoint` caches `m_firstBlock`/`m_firstOrdinaryInst`/params at its START. A pass that reshapes the entry point (e.g. inlining callees) MUST run BEFORE `processModule` as a top-level pre-pass, not inside `beginEntryPointImpl`, or the cached pointers go stale.
- Recursion reaching a terminate intrinsic is rejected upstream by E55201 before the CUDA legalizer runs.
- Prefer `inlineCall(call)` on the exact target call sites over `[ForceInline]` + `performForceInlining(func)` (the latter inlines ALL `[ForceInline]` callees and can loop forever on a recursive `[ForceInline]` callee) ([Slang CUDA/OptiX varying-param legalizer: terminate-intrinsic detection + pre-pass timing](wiki/learnings/1781782798777-slang-cuda-optix-varying-param-legalizer-terminate.md)).

**Triage lesson — search for the predecessor fix:** When a codegen bug looks like "works in the simple case, breaks in the nested case," grep closed issues — you're often looking at a scan/visitor that only covers the entry-point scope ([slang OptiX payload lost when terminate-intrinsic is in a callee (entrypoint-local writeback scan gap)](wiki/learnings/1781777421724-slang-optix-payload-lost-when-terminate-intrinsic-.md)).

## Tooling Note: PR-Review Runner Flag Parser

`devin-fetch.sh` (used in the slang PR-review runner) can return an empty `## Flags` section in `devin-flags.md` even when `devin-page.txt` clearly contains "N Flags" with per-flag titles + file:line locations. The parser expects a structured DOM region but Devin's compact view emits flags as a flat sequence. Always grep `devin-page.txt` for `\bN Flags\b` (N>0) and parse manually if the markdown is empty — don't skip findings just because `devin-flags.md` is empty ([slang-pr-review-runner devin-fetch.sh flag parser misses flags in devin-page.txt](wiki/learnings/1779429498527-slang-pr-review-runner-devin-fetch-sh-flag-parser-.md)).


## Recent operational learnings (incremental fold 2026-07-17)

**HitObject::TraceRay forces SPIR-V ≥1.5 (SER) regardless of -profile** — When reviewing/writing tests around SPIR-V target-version selection: any entry point calling `HitObject::TraceRay` drags the emitted SPIR-V module to **≥ 1.5** today, independent of `-profile`. [HitObject::TraceRay forces SPIR-V ≥1.5 (SER) regardless of -profile](wiki/learnings/1784148153622-hitobject-traceray-forces-spir-v-1-5-ser-regardles.md)

---

A callable/RT-payload null-rules crash spanning CUDA and Metal (#12273): a `[shader("callable")]` entry point with an OUTPUT (`out`/`inout` param or non-void return) crashes `slangc -target cuda`/`-target metal` with an access violation and **no diagnostic**. Root: `CUDALayoutRulesFamilyImpl::getCallablePayloadParameterRules()` returns `nullptr` (Metal's RT-payload rules are all null), and the callable-output path passes that null into `createTypeLayoutWith` → `_createTypeLayout` derefs it (`rules->GetScalarLayout`) before any diagnostic; the non-void RETURN routes through the same output path, so one root covers all variants (the `in`-param path IS diagnosed — asymmetric coverage). Fix floor = diagnose when the target's callable-payload rules are null, plus `SLANG_RELEASE_ASSERT(rules)` so future null-RT-rules regressions fail loudly. Reusable technique: a Windows `EXCEPTION_ACCESS_VIOLATION` compile crash reproduces as SIGSEGV on Linux Debug slangc with a `for tgt in cuda spirv hlsl glsl metal wgsl` differential + `-dump-ir` to see the last pass ([CUDA/Metal callable-shader output crash = null RT payload layout rules](wiki/learnings/1785369358728-cuda-metal-callable-shader-output-crash-null-rt-pa.md)).

**Source learnings (8):**
- [Implicit `IRRayPayloadDecoration` skips Slang's PAQ frontend validation](wiki/learnings/1779295178725-slang-raypayload-implicit-decoration-paq-gap.md)
- [Slang `legalizeRayPayloadAccessQualifiersForHLSL` — asymmetric `continue` leaves a user-reachable DXC-error hole](wiki/learnings/1779297394847-slang-raypayload-paq-pass-asymmetric-skip-gap.md)
- [PR #11224 for slang #10267 has a real coverage gap on hit-shader-only compiles](wiki/learnings/1779364869375-slang-10267-pr-11224-coverage-gap-anyhit-only.md)
- [slang-pr-review-runner devin-fetch.sh flag parser misses flags in devin-page.txt](wiki/learnings/1779429498527-slang-pr-review-runner-devin-fetch-sh-flag-parser-.md)
- [slang OptiX payload lost when terminate-intrinsic is in a callee](wiki/learnings/1781777421724-slang-optix-payload-lost-when-terminate-intrinsic-.md)
- [Slang CUDA/OptiX varying-param legalizer: terminate-intrinsic detection + pre-pass timing](wiki/learnings/1781782798777-slang-cuda-optix-varying-param-legalizer-terminate.md)
- [HitObject::TraceRay forces SPIR-V ≥1.5 (SER) regardless of -profile](wiki/learnings/1784148153622-hitobject-traceray-forces-spir-v-1-5-ser-regardles.md)
- [#12273 CUDA/Metal `[shader("callable")]` with an output null-derefs (getCallablePayloadParameterRules→nullptr passed to createTypeLayoutWith), no diagnostic; fix = diagnose + `SLANG_RELEASE_ASSERT(rules)`; AV↔SIGSEGV target differential repro](wiki/learnings/1785369358728-cuda-metal-callable-shader-output-crash-null-rt-pa.md)

_Catalog: [[wiki/index.md]]_
