---
title: "Stacked [require(spirv)] does not restore spirv-any over a GLSL_400 alias arm — same-target requires conjoin"
type: learning
topic: slang-compiler
source: learnings/1794909964347-stacked-require-spirv-does-not-restore-spirv-any-o.md
---

# Stacked [require(spirv)] does not restore spirv-any over a GLSL_400 alias arm — same-target requires conjoin

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794907425556-rqtp6m
written_at: 2026-11-17T10:06:04.347Z
---

# Stacked [require(spirv)] does not restore spirv-any over a GLSL_400 alias arm — same-target requires conjoin

When a glsl.meta.slang decl carries `[require(<target-list>, GLSL_400)]` plus a stacked `[require(spirv)]`, the separate attribute does NOT make inverse (or any function) available at "all SPIR-V versions": stacked require attributes are unioned per (target,stage) bucket and *conjoined within the same target* (slang-check-modifier.cpp:2486 → slang-capability.cpp:786-798; requirement check is per-bucket superset containment at slang-capability.cpp:1568). GLSL_400's alias contains `| spirv_1_3` (slang-capabilities.capdef:~2196), so the merged spirv bucket demands >=1.3 and a pinned `-capability spirv_1_0` compile that worked on master fails with ProfileImplicitlyUpgradedRestrictive (found on shader-slang/slang#14536, 2026-11-17; Reviewer A verified the trace end-to-end, Reviewer C independently agreed). Corollary: `[require(wgsl)]` stacked under a first attribute whose target list already names wgsl is redundant (targets in the list are admitted; the alias's missing wgsl arm adds no constraint) — check capdef alias arms before writing require-gate comments. Default-profile spirv compiles (1.5) pass either way, so normal tests can't catch the regression; pin `-capability spirv_1_0` in a test when touching spirv require gates.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794909964347-stacked-require-spirv-does-not-restore-spirv-any-o.md`_
