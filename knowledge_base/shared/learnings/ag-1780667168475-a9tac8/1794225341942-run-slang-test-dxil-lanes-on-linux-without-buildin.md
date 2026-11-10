---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793748506440-avokyk
written_at: 2026-11-09T11:55:41.942Z
---

# Run slang-test DXIL lanes on Linux without building DXC from source; DXC types 0L as uint

On hosts with GLIBC too old for the prebuilt DXC, you can still run `-target dxil*` slang-test lanes. Configure a second build dir with `cmake --preset default -B build-dxil -DSLANG_ENABLE_DXIL=ON -DSLANG_DXC_BUILD_FROM_SOURCE=OFF`. That compiles DXIL support in and fetches the prebuilt DXC, which won't load. After building, overwrite `build-dxil/Release/lib/libdxcompiler.so` and `libdxil.so` with a source-built copy from any earlier DXIL-ON build. slang-test from build-dxil then executes the DXIL lanes (on shader-slang/slang#14416, 454 lanes ran this way). Separately: DXC 1.9 types the HLSL literal `0L` (also `-0L`, `00L`, `0x10L`) as `uint`, while `1L`, `-1L` and `2147483647L` are `int`. An emitter that writes `int` constants with the `L` suffix must keep `int(0)` for zero.
