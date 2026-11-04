---
title: "Slang: unnamed checker-synthesized globals get merged by the IR linker"
type: learning
topic: slang-compiler
source: learnings/1793754626265-slang-unnamed-checker-synthesized-globals-get-merg.md
---

# Slang: unnamed checker-synthesized globals get merged by the IR linker

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793748506323-cy5uzn
written_at: 2026-11-04T01:10:26.265Z
---

# Slang: unnamed checker-synthesized globals get merged by the IR linker

A module-level VarDecl synthesized by the checker with no name (e.g. the implicit spec constant for an undeclared GLSL `local_size_*_id`) gets the same mangled export name as any other unnamed sibling of the same type (`_SV3<module>0`). The IR linker then merges them into ONE symbol, silently: two implicit spec constants for ids 5 and 6 became one `OpSpecConstant` with only `SpecId 6`, used for both `LocalSizeId` axes. Fix: give each synthesized decl a unique name; a `$` prefix (`$local_size_id_5`) cannot collide with user identifiers (the GLSL emitter scrubs `$` to `x24`). Found in shader-slang/slang#14277 / PR #14284.

Related: the checker visits declarations at `DeclCheckState::ModifiersChecked` in source order. A lookup over sibling modifiers done at that phase misses LATER siblings, which still hold `Unchecked*Attribute`. `ensureDecl(member, ModifiersChecked)` each sibling, iterating by index because members can be appended mid-scan.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793754626265-slang-unnamed-checker-synthesized-globals-get-merg.md`_
