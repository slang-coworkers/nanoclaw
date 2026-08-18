---
title: "CUDA/Metal callable-shader output crash = null RT payload layout rules (null-deref, no diagnostic)"
type: learning
topic: slang-compiler
source: learnings/1785369358728-cuda-metal-callable-shader-output-crash-null-rt-pa.md
---

# CUDA/Metal callable-shader output crash = null RT payload layout rules (null-deref, no diagnostic)

**shader-slang/slang#12273** — `[shader("callable")]` entry point with an OUTPUT value (`out`/`inout` param OR non-void return) crashes `slangc -target cuda` with EXCEPTION_ACCESS_VIOLATION and NO diagnostic. Same crash on `-target metal`. SPIR-V/HLSL/GLSL compile fine; WGSL cleanly aborts (`E99997 unsupported stage`).

**Root cause (verified @HEAD 6462d7d2f):** `CUDALayoutRulesFamilyImpl::getCallablePayloadParameterRules()` returns `nullptr` (`source/slang/slang-type-layout.cpp:2553`; the CUDA callable-payload rules global is commented out at `:1339`). Metal's RT rules (`getRayPayloadParameterRules`/`getCallablePayloadParameterRules`/`getHitAttributesParameterRules`, `:2836/2841/2846`) are ALL null. When a callable has an output, `processEntryPointVaryingParameter` (`slang-parameter-binding.cpp:2430-2435`) passes that null rules pointer into `createTypeLayoutWith` (`slang-type-layout.cpp:6422`) → `context.with(rules)` (no guard, `.h:1568`) → `_createTypeLayout` basic-type branch derefs it at **`slang-type-layout.cpp:5476`** (`rules->GetScalarLayout(...)`). Crash precedes any diagnostic. The non-void RETURN form routes the result through the SAME output path (`slang-parameter-binding.cpp:3544-3557`), so one root cause covers all three variants. Note the `in`-param path IS diagnosed (E39018 `DontExpectInParametersForStage`, `:2456`) — coverage is asymmetric: callable OUTPUTs are neither supported nor diagnosed.

**Fix floor (what the maintainer asked for):** turn the crash into a diagnostic when the target's callable-payload rules are null — the Callable output branch at `slang-parameter-binding.cpp:2430-2435` should diagnose instead of calling `createTypeLayoutWith` with null (reuse/extend `DontExpectOutParametersForStage` `:2416`). Harden with `SLANG_RELEASE_ASSERT(rules)` in `createTypeLayoutWith` so future null-RT-rules regressions fail loudly instead of as a silent AV. Actual CUDA/OptiX callable codegen support is the separate feature #12182.

**Reusable technique:** a Windows `EXCEPTION_ACCESS_VIOLATION` compile-time crash reproduces on Linux as SIGSEGV (exit 139) with the local `build/Debug/bin/slangc` — no GPU/Windows needed for callable/RT crashes. Run a **target differential** (`for tgt in cuda spirv hlsl glsl metal wgsl`) to scope blast radius; and use `-dump-ir` to see the last pass before the crash (here it printed only `LOWER-TO-IR`, confirming the fault is in early parameter-binding/type-layout, not a late IR pass). When a `getXxxParameterRules()` family method returns `nullptr` for a target, any code passing it to `createTypeLayoutWith`/`context.with()` will null-deref without a diagnostic — a recurring shape worth grepping for.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785369358728-cuda-metal-callable-shader-output-crash-null-rt-pa.md`_
