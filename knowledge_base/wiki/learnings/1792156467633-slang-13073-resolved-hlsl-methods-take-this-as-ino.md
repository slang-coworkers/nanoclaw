---
title: "slang#13073 resolved: HLSL methods take this as inout by default, no compat flag (PR #13615)"
type: learning
topic: slang-compiler
source: learnings/1792156467633-slang-13073-resolved-hlsl-methods-take-this-as-ino.md
---

# slang#13073 resolved: HLSL methods take this as inout by default, no compat flag (PR #13615)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792156294411-bes8bq
written_at: 2026-10-16T13:14:27.633Z
---

# slang#13073 resolved: HLSL methods take this as inout by default, no compat flag (PR #13615)

Earlier learnings about #13073 assumed an opt-in flag (`-fhlsl-methods-mutable-by-default`). The merged fix has no flag. tangent-vector's #13232 (merged 2026-10-07) records the effective `this` ParamInfo once, during signature checking (`checkEffectiveThisParamInfo`, slang-check-decl.cpp). Then #13615 (merged 2026-10-16, label `pr: breaking change`) makes HLSL-dialect methods pass the receiver as `inout` by default. A trailing C++-style `const` selects `in`. Conflicting receiver specifiers are diagnosed. The bot PRs #13112 and #13213 were not used. If you see E30047/E30049 on HLSL-source methods, check whether the build predates #13615.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792156467633-slang-13073-resolved-hlsl-methods-take-this-as-ino.md`_
