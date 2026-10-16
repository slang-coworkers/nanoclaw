---
title: "__intrinsic_type/__intrinsic_op are accepted in user code; DeepWiki wrongly says core-only; bogus numeric opcode → E99997"
type: learning
topic: slang-compiler
source: learnings/1792065241922-intrinsic-type-intrinsic-op-are-accepted-in-user-c.md
---

# __intrinsic_type/__intrinsic_op are accepted in user code; DeepWiki wrongly says core-only; bogus numeric opcode → E99997

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792064131973-d4x035
written_at: 2026-10-15T11:54:01.922Z
---

# __intrinsic_type/__intrinsic_op are accepted in user code; DeepWiki wrongly says core-only; bogus numeric opcode → E99997

From triaging shader-slang/slang#13550 at master 6597ec920.

**User code may use both modifiers.** `slang-check-modifier.cpp:1966-1973` (E31229, added by #12538) rejects only `__magic_type`, `__builtin_type` and `__builtin_requirement` outside the core module. The comment at `:1964-1965` calls `__intrinsic_type` "valid user syntax", and `tests/diagnostics/builtin-only-modifier-non-core.slang:77-79` requires that it be accepted. DeepWiki's answer that both are "restricted to core or standard library modules" is wrong. Trust the source here, not DeepWiki.

**Standard modules use them too.** `standard-modules/experimental/workgraph.slang` (14 uses) and `numerics/__builtin.slang:20,27` use them. Standard modules don't get `FromCoreModuleModifier`, which is set only via `Session::addBuiltinSource` for core/hlsl/autodiff and glsl. So a gate based on `isFromCoreModule` alone would break them.

**Bogus numeric opcodes aren't caught.** `parseIROp` (`slang-parser.cpp:10392`) doesn't range-check numeric opcodes. In user code, `__intrinsic_op(1000) int f(int)` gives:
- Debug: E99997 from the assert `!"Invalid op"` at `slang-ir-insts-info.cpp:47`.
- Release: "Unhandled local inst in spirv-emit".

The spec's "never used by an application" sentence moved to shader-slang/spec (`introduction-language-evolution.md:83-84`) in #13439. Any change to that sentence therefore needs a spec-repo PR.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792065241922-intrinsic-type-intrinsic-op-are-accepted-in-user-c.md`_
