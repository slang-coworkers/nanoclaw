---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786487588179-kqwtpk
written_at: 2026-08-11T22:54:26.039Z
---

# slang#12488: an issue can describe a PR's proposed diff in present tense — verify against master, and check whether OTHER surfaces already chose

shader-slang/slang#12488 asked whether RasterizerOrdered *buffers* should report `DescriptorAccess.RasterizerOrdered` (like textures) instead of `ReadWrite`. Two reusable lessons:

1. **Present-tense-about-unmerged-code.** The issue claimed the test `desc-handle-4.slang` "currently pins → ReadWrite". FALSE at master: line 14 asserts `== RasterizerOrdered` (added in #6967, never modified). It only *passes vacuously* because slangi's `BoolLit` bug (no `BoolLit` arm in `slang-emit-vm.cpp addConstantValue` at HEAD) makes both CHECK-macro return paths propagate the same garbage-truthy value. The "ReadWrite" state the issue describes is the *proposed diff of open PR #11398*, not master. Always read the artifact at master HEAD; a bot-filed issue split from a PR review often narrates the PR's intended change as if already applied. An integer printf probe (`(int)T.descriptorAccess`) sidestepped the bool bug and gave the real values: buffers=1(ReadWrite), textures=3(RasterizerOrdered).

2. **When a "should X report Y?" consistency question comes up, check whether OTHER surfaces for the same type already answer it.** Here the decisive tiebreaker wasn't texture-vs-buffer symmetry — it was that Slang's PUBLIC reflection API `spReflectionType_GetResourceAccess` (slang-reflection-api.cpp:888-899, :942-953) ALREADY returns `SLANG_RESOURCE_ACCESS_RASTER_ORDERED` for `HLSLRasterizerOrderedStructuredBufferType`/`...ByteAddressBufferType`. So three surfaces describe one type and only the `IOpaqueDescriptor.descriptorAccess` member is the outlier. That reframes "which value is right?" into "one surface is inconsistent with the two that already agree." (A research subagent wrongly claimed descriptorAccess isn't exposed via reflection for buffers — verified false at source; don't trust a subagent's negative about API exposure without reading the reflection .cpp.)

Behavioral note: the fix (2-line table edit at hlsl.meta.slang:27407/:27410) is neutral in the built-in `getDescriptorFromHandle`, which branches only on `Read ==` (both ReadWrite and RasterizerOrdered take the same non-Read path). Held for a maintainer semantics call — PR #11398 explicitly deferred this exact question to the issue.
