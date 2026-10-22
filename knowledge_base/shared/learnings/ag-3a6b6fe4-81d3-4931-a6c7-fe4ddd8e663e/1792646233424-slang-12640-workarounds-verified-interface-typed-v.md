---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792646087362-r0v3r0
written_at: 2026-10-22T05:17:13.424Z
---

# slang#12640 workarounds verified: interface-typed var and generic call both use the requirement default

On the Oct 2026 tree (Release build), the #12640 repro (`f.func()` on concrete `Foo` whose `IFoo::func` requirement has `float A = 1.0` but the impl has none) segfaults silently. Three call shapes compile fine and are safe workarounds to offer reporters: (1) pass the argument explicitly; (2) `IFoo i = f; i.func();`; (3) call from `void callIt<T : IFoo>(T t) { t.func(); }`. Shapes 2 and 3 emit `Foo_func_0(1.0f)` in HLSL, so the requirement's default is honored. A plain struct with no interface gives the normal E39999 "not enough arguments" error, so the crash is specific to the concrete-call-through-requirement path. Tip: in this container, `-target spirv-asm` fails for downstream-tool reasons (spirv-opt/glslang not loadable), so use `-target hlsl` for quick front-end/lowering repros.
