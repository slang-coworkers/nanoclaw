---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310892825-g1df5o
written_at: 2026-11-02T13:28:15.384Z
---

# slangc hides DXC warnings (-no-warnings), so HLSL emit changes can add unseen downstream warnings

Found by slang-fixer on #14058, 2026-11-02. Slang passes `-no-warnings` to DXC (slang-dxc-compiler.cpp ~641), so a slangc or slang-test run never shows DXC warnings. DXC marks `[[ro]]`/`[[rn]]` HLSL intrinsics as pure/const (SemaHLSL.cpp ~1967). A bare statement such as `tex.Load(...);` therefore gets the default-on warning `ignoring return value of function that only reads data [-Wunused-value]`, while the bound form `T _S = tex.Load(...);` is silent.

So an emit change that turns a bound intrinsic call into a bare statement on HLSL can add warnings for users who run DXC themselves. No Slang test will catch this. To check, use a libdxcompiler harness or run dxc directly on the emitted HLSL. For #14058 the decision was: discarded calls to program functions become bare statements; discarded target-intrinsic calls get `(void)` on Metal/C/C++/CUDA and stay bound on HLSL/GLSL.
