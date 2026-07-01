---
title: "slang -target hpp/cpp 'no output file' is usually a crash from a graphics-stage entry point"
type: learning
topic: slang-compiler
source: learnings/1781783056677-slang-target-hpp-cpp-no-output-file-is-usually-a-c.md
---

# slang -target hpp/cpp "no output file" is usually a crash from a graphics-stage entry point

When a user reports `slangc -target hpp` (or `-target cpp`) "generates no output file" / "silent no output", suspect a **segfault**, not a silent no-op. `-o` writes nothing on crash, and on Windows the crash dialog is easy to miss.

**Root cause pattern (verified shader-slang/slang#11659 @ HEAD a84f48e62):** `hpp`=`SLANG_CPP_HEADER`, `cpp`=`SLANG_CPP_SOURCE` are CPU/host-C++ targets that only support **compute** entry points. Feeding a **graphics-stage** entry point (vertex/fragment, anything with a result-position system value like `SV_Position`/`SV_Target`) crashes the varying-param legalizer.

Minimal crashing repro:
```slang
struct Out { float4 p : SV_Position; }
[shader("vertex")] Out main() { Out o; o.p = float4(0,0,0,1); return o; }
```
`slangc -target hpp -o out.hpp d.slang` → SIGSEGV. `[shader("compute")] void main(){}` is fine.

**Crash mechanism (code trace):** `source/slang/slang-ir-legalize-varying-params.cpp:1048` (twin `:1059`) derefs `m_param->sourceLoc`, but `m_param` is null: it defaults null (`:540`), is set only in `processParam` (`:545`), and `processEntryPoint` (`:412`) legalizes the entry-point **result first** (`:451-462`, before the param loop at `:518`). The CPU SV override (~`:2259/:2280`) handles only compute SVs, so a result-position graphics SV falls to `default: diagnoseUnsupportedSystemVal` → null-deref. Compute entries have a `void` result + only compute SVs so never reach it.

**Triage shortcut:** bisect by entry-point STAGE first (compute vs vertex/fragment), not by the fancy-looking constructs (`export cbuffer`, `StructuredBuffer<T>.Handle`, namespaces, `-fvk-use-c-layout` were all red herrings in #11659).

**Fix layers:** front-end diagnostic rejecting non-compute stages for CPU host-C++ targets (`slang-check-shader.cpp`, reuse `slang-diagnostics.lua:2301`) + legalizer null-guard (`m_param ? ... : m_entryPointFunc->sourceLoc`).

**Aside:** `-target hpp` only emits declarations marked `__extern_cpp` for compute kernels (canonical shape: `tests/headers/generate-hpp-header.slang`); sharing plain struct/cbuffer layouts with host C++ is an unsupported feature gap (#9401), separate from the crash.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781783056677-slang-target-hpp-cpp-no-output-file-is-usually-a-c.md`_
