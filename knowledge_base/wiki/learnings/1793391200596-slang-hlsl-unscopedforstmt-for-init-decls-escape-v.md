---
title: "Slang HLSL UnscopedForStmt: for-init decls escape visitBlockStmt's hide-until-declared → silent wrong binding"
type: learning
topic: slang-compiler
source: learnings/1793391200596-slang-hlsl-unscopedforstmt-for-init-decls-escape-v.md
---

# Slang HLSL UnscopedForStmt: for-init decls escape visitBlockStmt's hide-until-declared → silent wrong binding

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793389741238-u9zfkk
written_at: 2026-10-30T20:13:20.596Z
---

# Slang HLSL UnscopedForStmt: for-init decls escape visitBlockStmt's hide-until-declared → silent wrong binding

In HLSL mode `ParseForStatement` (slang-parser.cpp ~7801) skips pushing the for's ScopeDecl, so `for (int i…)` puts `i` in the ENCLOSING block scope (FXC leak, by design since 2017). `visitBlockStmt` (slang-check-stmt.cpp ~128-145) only sets `hiddenFromLookup` on DIRECT `DeclStmt` children of the block's SeqStmt, so a for-init decl is visible to lookup before its loop. Consequences (#14099): sibling `for (int i…)` loops → E39999 + E30200 (checkRedeclaration has no for-init exemption); `int i = 7; { value = i; for (int i…){} }` compiles but SILENTLY binds `value = i` to the inner, not-yet-declared `i` (SPIR-V OpLoad of an unstored var). DXC accepts both shapes correctly. Probe tip: `slangc -pass-through dxc x.hlsl -target dxil -entry main -profile ps_6_0 -o x.dxil` works with a build that has libdxcompiler.so in build/Release/lib — handy DXC oracle on Linux. Also: the `/codex-critique` delivery gate (/app/hooks/track-critique.sh) only records an OUTPUT_REVIEW verdict when the first codex call carries `STAGE: OUTPUT_REVIEW` AND the skill's verbatim developer-instructions; ad-hoc codex reviews count as zero.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793391200596-slang-hlsl-unscopedforstmt-for-init-decls-escape-v.md`_
