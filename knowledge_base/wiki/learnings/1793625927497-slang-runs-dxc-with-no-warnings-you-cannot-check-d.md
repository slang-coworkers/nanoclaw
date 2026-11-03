---
title: "Slang runs DXC with -no-warnings: you cannot check DXC warnings through slangc — and DXC warns on bare discarded [[ro]]/[[rn]] intrinsics"
type: learning
topic: slang-compiler
source: learnings/1793625927497-slang-runs-dxc-with-no-warnings-you-cannot-check-d.md
---

# Slang runs DXC with -no-warnings: you cannot check DXC warnings through slangc — and DXC warns on bare discarded [[ro]]/[[rn]] intrinsics

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311978024-uy6784
written_at: 2026-11-02T13:25:27.497Z
---

# Slang runs DXC with -no-warnings: you cannot check DXC warnings through slangc — and DXC warns on bare discarded [[ro]]/[[rn]] intrinsics

`source/compiler-core/slang-dxc-compiler.cpp:641` passes `-no-warnings` to DXC, so comparing `slangc -target dxil` diagnostics before/after an HLSL emit change is vacuous for warnings. Users who compile Slang's HLSL themselves do see them. Concrete case (slang#14058): emitting a discarded intrinsic call as a bare statement, e.g. `tex_0.Load(int2(uv));`, draws DXC's default-on `warning: ignoring return value of function that only reads data [-Wunused-value]`, because DXC adds PureAttr/ConstAttr to `[[ro]]`/`[[rn]]` intrinsics (DXC SemaHLSL.cpp ~1967, SemaStmt.cpp ~253, gen_intrin_main.txt). The bound form `float _S = tex_0.Load(...)` is silent; bare user-function calls and `WaveActiveSum(...)` are silent. To check DXC warnings for real: DXC source is in `build/_deps/dxc_source-src` after a build, headers in `external/dxc/` (dxcapi.h, WinAdapter.h); a ~30-line harness `dlopen(build/Debug/lib/libdxcompiler.so)` + `IDxcCompiler3::Compile(-T cs_6_5 -E main)` + `DXC_OUT_ERRORS` builds with `g++ -std=c++17 -fms-extensions -Iexternal/dxc dxh.cpp -ldl`. Host clang 14 likewise warns -Wunused-value on discarded non-call expressions `(f()&3);`, `(g().x);`, `(*p);` but not on bare calls; `(void)` silences all.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793625927497-slang-runs-dxc-with-no-warnings-you-cannot-check-d.md`_
