---
title: "Slang shader-coverage: 64-bit counter feasibility + diagnostic-numbering caveat (issue #11452)"
type: learning
topic: slang-compiler
source: learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md
---

# Slang shader-coverage: 64-bit counter feasibility + diagnostic-numbering caveat (issue #11452)

Triaging shader-slang/slang#11452 (default coverage counters 32→64-bit) surfaced several reusable facts about the shader-coverage feature and triage process. Verified at HEAD b305a4df4.

**64-bit atomic-add already exists — reuse, don't rebuild.** Slang has a full `atomic64` capability alias = `GL_EXT_shader_atomic_int64 | _sm_6_6 | cpp | cuda`. SPIR-V `ensureAtomicCapability()` auto-declares `Int64Atomics` when a `kIROp_AtomicAdd` operand is uint64/int64; HLSL emits `InterlockedAdd` (needs SM6.6); CUDA native `atomicAdd(unsigned long long*)`. So switching the coverage counter element type to uint64 reuses existing per-backend lowering. The ONLY net-new backend code is the CPU prelude — `prelude/slang-cpp-prelude.h:342-373` has `_slang_atomic_add_u32/_i32` only, no 64-bit variant.

**Coverage counter width is hardcoded in the instrumentation pass.** `source/slang/slang-ir-coverage-instrument.cpp:684` (`synthesizeCoverageBuffer`, `builder.getUIntType()`), `:928` (instrumenter ctor), `:1008-1017` (`lowerMarkerOp` atomic literal/result). Manifest element_type/element_stride live in `source/slang/slang-api.cpp:1205-1206` (`slang_writeCoverageManifestJson`, version 2) — already present but hardcoded "uint32"/4. WGSL special-cases + skips unsupported targets at instrument.cpp:1216-1221.

**ABI: CoverageBufferInfo uses a MIN-SIZE structSize check, not exact-match** (`source/compiler-core/slang-artifact-associated-impl.cpp:435`), so appending fields (e.g. `elementByteWidth`) is genuinely ABI-safe via `SLANG_WRITE_OPTIONAL_COVERAGE_ENTRY_FIELD`. NOTE: the `include/slang.h` doc comment says "mismatched structSize" which misleadingly implies exact-match — trust the code, not the comment.

**Process caveat — verify diagnostic codes against HEAD.** The issue confidently cited `E45113`, but the coverage diagnostic range in `source/slang/slang-diagnostics.lua:4739-4790` is contiguous 45100–45107, so next-free at HEAD is **45108**. The gap (45108–45112) was reserved by the author's unmerged stacked branches. Lesson: an issue/PR can cite a diagnostic code that doesn't exist at HEAD because it assumes its own stack has landed — always grep the diagnostics file and flag the discrepancy rather than echoing the issue's number.

**Triage-vs-author-owned-PR:** when an issue already has an in-flight PR by the issue author (here draft #11451, blocked on ready CLI #11336), scope the fixer to DESIGN VALIDATION, not a competing implementation — opening a duplicate PR on someone's active feature is churn.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780489631750-slang-shader-coverage-64-bit-counter-feasibility-d.md`_
