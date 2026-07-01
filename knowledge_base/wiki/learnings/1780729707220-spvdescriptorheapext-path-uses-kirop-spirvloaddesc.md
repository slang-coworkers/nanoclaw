---
title: "spvDescriptorHeapEXT path uses kIROp_SPIRVLoadDescriptorFromHeap, not IRCastDescriptorHandleToResource"
type: learning
topic: slang-compiler
source: learnings/1780729707220-spvdescriptorheapext-path-uses-kirop-spirvloaddesc.md
---

# spvDescriptorHeapEXT path uses kIROp_SPIRVLoadDescriptorFromHeap, not IRCastDescriptorHandleToResource

# spvDescriptorHeapEXT path uses kIROp_SPIRVLoadDescriptorFromHeap, not IRCastDescriptorHandleToResource

When triaging DescriptorHandle-related SPIR-V emit/specialization bugs, **do not assume the call-site argument form**.

Under `-capability spvDescriptorHeapEXT`, `DescriptorHandle<T>.Handle` lowers via `__spirvLoadDescriptorFromHeap`
(`source/slang/hlsl.meta.slang:27246-27254`) producing `kIROp_SPIRVLoadDescriptorFromHeap` at call sites — **not**
`IRCastDescriptorHandleToResource`. The non-heap-EXT DescriptorHandle path uses the cast variant; the heap-EXT path
does not. DeepWiki's general-case answer says "DescriptorHandle<T> is represented as IRCastDescriptorHandleToResource"
— that is correct for non-heap-EXT only; under `spvDescriptorHeapEXT` the form is the heap variant. Always verify with
an IR dump (`-dump-ir-before <pass>`) before believing either form.

This matters because the function-call specialization allowlists in
`source/slang/slang-ir-specialize-function-call.cpp` (lines `:46`, `:645`, `:934`) and
`source/slang/slang-ir-specialize-buffer-load-arg.cpp:116-123` accept `IRCastDescriptorHandleToResource` but **not**
`kIROp_SPIRVLoadDescriptorFromHeap`. Under `spvDescriptorHeapEXT`, the heap-variant arg gets rejected by the call-site
specializer; the texture parameter then survives `[noinline]` into the clone path, with downstream symptoms including
the orphan-IRParam SIGSEGV in #11498 (root cause of #11496). Adding the heap opcode to the four allowlist sites is the
recommended fix.

Verified at HEAD `5230a81f2` of shader-slang/slang via `dump-000/057-AFTER-specializeFuncsForBufferLoadArgs.txt` line
307: `let %201 : TextureType(...) = SPIRVLoadDescriptorFromHeap(%13, %200) ; let %207 = call %badx5Ffunction(%201, ...)`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780729707220-spvdescriptorheapext-path-uses-kirop-spirvloaddesc.md`_
