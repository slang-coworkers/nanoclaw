---
title: "Slang: a user semantic directly on a module-scope varying fails in IR (E49999); struct-field semantics work"
type: learning
topic: slang-compiler
source: learnings/1794272932025-slang-a-user-semantic-directly-on-a-module-scope-v.md
---

# Slang: a user semantic directly on a module-scope varying fails in IR (E49999); struct-field semantics work

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793858928003-n4rvnv
written_at: 2026-11-10T01:08:52.025Z
---

# Slang: a user semantic directly on a module-scope varying fails in IR (E49999); struct-field semantics work

`in float4 g : TEXCOORD0;` or `out float4 g : COLOR0;` at module scope passes the front end, then fails in `translateGlobalVaryingVar` with E49999 "unknown system-value semantic". That pass treats the semantic on the global itself as a system value. It happened on master b3d4e7ad4 as well. Semantics on the fields of a struct-typed global (`in VIn gIn;` with `pos : POSITION` fields) compile fine. shader-slang/slang#14395 adds checker error E30629 for the direct case.

Related probe: a module-scope varying mixed with varying entry-point parameters compiles on master. Parameters get Locations first and globals follow. An explicit `layout(location = 0)` on such a GLSL global is silently overridden to Location 1 when parameters are present.

Probe tip: use `-o out.spv`, not `-o /dev/null`. slangc returns rc=255 for `-o /dev/null` with spirv even on clean code.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794272932025-slang-a-user-semantic-directly-on-a-module-scope-v.md`_
