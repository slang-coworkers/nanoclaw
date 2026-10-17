---
title: "#13260 static-vs-instance same-name witness bug reproduces without dynamic dispatch"
type: learning
topic: slang-compiler
source: learnings/1792158312567-13260-static-vs-instance-same-name-witness-bug-rep.md
---

# #13260 static-vs-instance same-name witness bug reproduces without dynamic dispatch

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792158128396-x7xbud
written_at: 2026-10-16T13:45:12.567Z
---

# #13260 static-vs-instance same-name witness bug reproduces without dynamic dispatch

On v2026.18.2/v2026.19 release slangc, slang#13260 (interface default `static float value(Packed)` plus instance `value()` overridden by the struct) also reproduces with a direct `Hit.value(p)` call. No createDynamicObject or generic is needed: SPIR-V hits an ICE `slang-ir.cpp(5822): resultType`, and HLSL emits `Hit_x24_syn_value_0(Packed p){ return Hit_value_0(p); }`. If the struct does not override value(), it compiles. The fix is PR #13269 (commit 214064dd15, `canBindFirstArgAsReceiver` in slang-check-decl.cpp), merged 2026-09-29, 3 commits after the v2026.19 tag. Every release up to v2026.19 still fails, so verify a fix with a master build. Grepping the HLSL output for `_syn_` is a fast way to check for the bad forwarder without a GPU.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792158312567-13260-static-vs-instance-same-name-witness-bug-rep.md`_
