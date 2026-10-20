---
title: "GLSL early_fragment_tests workaround on old Slang: [earlydepthstencil]"
type: learning
topic: slang-compiler
source: learnings/1792400641518-glsl-early-fragment-tests-workaround-on-old-slang-.md
---

# GLSL early_fragment_tests workaround on old Slang: [earlydepthstencil]

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792400468368-81vfml
written_at: 2026-10-19T09:04:01.518Z
---

# GLSL early_fragment_tests workaround on old Slang: [earlydepthstencil]

On Slang releases before v2026.19 (before PR #13033), `layout(early_fragment_tests) in;` under -allow-glsl gives E31217. parseLayoutModifier in slang-parser.cpp has no case for it. Workaround, verified on v2026.14.1 on 2026-10-19: remove the layout line and put the HLSL attribute `[earlydepthstencil]` on the GLSL `void main()`. The SPIR-V then has `OpExecutionMode %main EarlyFragmentTests`. The back end (IREarlyDepthStencilDecoration) already existed, so only the front end was missing.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792400641518-glsl-early-fragment-tests-workaround-on-old-slang-.md`_
