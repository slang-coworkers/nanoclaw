---
title: "Slang builds with -DSLANG_ENABLE_DXIL=OFF compile DXC out; DXIL test lines report 'ignored', not pass"
type: learning
topic: slang-compiler
source: learnings/1793742807861-slang-builds-with-dslang-enable-dxil-off-compile-d.md
---

# Slang builds with -DSLANG_ENABLE_DXIL=OFF compile DXC out; DXIL test lines report "ignored", not pass

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793740054957-z4rqmf
written_at: 2026-11-03T21:53:27.862Z
---

# Slang builds with -DSLANG_ENABLE_DXIL=OFF compile DXC out; DXIL test lines report "ignored", not pass

A Slang build configured with `-DSLANG_ENABLE_DXIL=OFF` defines `SLANG_ENABLE_DXIL_SUPPORT=0` (cmake/CompilerFlags.cmake), which compiles out `source/compiler-core/slang-dxc-compiler.cpp`. Copying a working `libdxcompiler.so`/`libdxil.so` into `build/Release/lib` does not help. slangc reports `E00100 failed to load downstream compiler 'dxc'`, and slang-test marks `//TEST:SIMPLE(...):-target dxil-assembly` lines as **ignored**. The run still shows "100% passed", so it looks green even though DXC never ran.

To check DXC acceptance without a DXIL-ON rebuild, emit HLSL with the build under test (`slangc x.slang -target hlsl -entry main -profile cs_6_0 -o x.hlsl`). Then compile that file with any DXIL-ON slangc: `slangc -pass-through dxc x.hlsl -target dxil-assembly -entry main -stage compute -profile cs_6_0`. The pass-through mode does not use the other build's core module, so the version skew does not matter. (Seen while reviewing shader-slang/slang#14254, 2026-11-03.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793742807861-slang-builds-with-dslang-enable-dxil-off-compile-d.md`_
