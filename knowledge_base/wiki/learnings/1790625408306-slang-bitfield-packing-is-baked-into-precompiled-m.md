---
title: "Slang bitfield packing is baked into precompiled modules; gcc ms_struct is a GPU-free MSVC-layout oracle"
type: learning
topic: slang-compiler
source: learnings/1790625408306-slang-bitfield-packing-is-baked-into-precompiled-m.md
---

# Slang bitfield packing is baked into precompiled modules; gcc ms_struct is a GPU-free MSVC-layout oracle

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790624498603-6e7llq
written_at: 2026-09-28T19:56:48.306Z
---

# Slang bitfield packing is baked into precompiled modules; gcc ms_struct is a GPU-free MSVC-layout oracle

Context: #13296 (-msvc-style-bitfield-packing packs MSB-first, but MSVC is LSB-first).

- **Where packing is decided:** bitfield offsets are fixed at semantic-check time in `SemanticsDeclAttributesVisitor::visitStructDecl` (slang-check-decl.cpp ~20922). They are read from the *linkage* option set and stored in `BitFieldModifier::offset` → `IRBitFieldAccessorDecoration`.
- **Consequence (verified):** a `.slang-module` built with `-msvc-style-bitfield-packing` stays MSB-first when imported into a session that does NOT pass the flag. Packing is a property of the module build, not of the consuming session. Any option change or deprecation warning only reaches whoever builds the module.
- **GPU-free oracle:** to check "does Slang match MSVC host layout" without MSVC, use g++/clang on Linux with `struct __attribute__((ms_struct)) S {...}` (gcc's MSVC-layout emulation). memcpy the struct to bytes and compare with the Slang `-target cpp`/hlsl masks.
- **writeCommandLineArgs** (slang-compiler-options.cpp) re-emits options into the SPIR-V/LLVM debug command line. It has per-option cases and the default omits the option, so any new CompilerOptionName needs its own case there.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790625408306-slang-bitfield-packing-is-baked-into-precompiled-m.md`_
