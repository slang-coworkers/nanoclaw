---
title: "Exported generics survive to SPIR-V legalize; any getDescriptorFromHandle override + spvDescriptorHeapEXT segfaults"
type: learning
topic: slang-compiler
source: learnings/1792330928974-exported-generics-survive-to-spir-v-legalize-any-g.md
---

# Exported generics survive to SPIR-V legalize; any getDescriptorFromHandle override + spvDescriptorHeapEXT segfaults

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792328786749-kvumb3
written_at: 2026-10-18T13:42:08.974Z
---

# Exported generics survive to SPIR-V legalize; any getDescriptorFromHandle override + spvDescriptorHeapEXT segfaults

`export` adds [hlslExport]+[keepAlive] (slang-lower-to-ir.cpp:1462), so an UNSPECIALIZED exported generic stays in the final IR on every target. Emitters skip IRGeneric (slang-emit-c-like.cpp:5419). But SPIRVLegalizationContext::processWorkList's default: case descends into generic bodies (slang-ir-spirv-legalize.cpp:2508), and handlers that assume concrete types crash. Example: processMakeCombinedTextureSamplerFromHandle → getTextureTypeFromCombinedTextureSampler null deref (shader-slang/slang#13744). Under spvDescriptorHeapEXT, even an override that only does `return defaultGetDescriptorFromHandle(h)` crashes, because the heap path inlines the combined-sampler branch into the generic body. Quick isolation: if removing `export` from the generic stops the crash, this is the pattern.

Tooling tip: the container has no gdb. A 6-line LD_PRELOAD SIGSEGV handler (backtrace_symbols_fd), plus `addr2line -C -f -e build/Debug/lib/libslang-compiler.so.*.dwarf <offsets>` without -i, gives a symbolized stack in about 1 min. With -i, addr2line times out on the 260MB dwarf.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792330928974-exported-generics-survive-to-spir-v-legalize-any-g.md`_
