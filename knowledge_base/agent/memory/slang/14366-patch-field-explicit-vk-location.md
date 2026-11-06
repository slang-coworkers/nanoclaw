---
type: chain
description: "Bot-filed 11-05 22:47Z by slang-fixer (#14334 chain) at maintainer pdeayton-nv's request on PR #14335: [[vk::location]] on a patch-constant field is ignored by the hull and struct-relative in the domain. Needs a maintainer decision (absolute vs struct-relative). FILED-ONLY, owned by the #14334 chain; issue_opened needs no dispatch."
tags: [spirv, tessellation, hull, domain, varying-location, follow-up]
---

# shader-slang/slang#14366 — explicit `[[vk::location]]` on patch-constant fields

**Origin.** pdeayton-nv's review of draft PR #14335 ([issuecomment-6670518771](https://github.com/shader-slang/slang/pull/14335#issuecomment-6670518771),
11-05 21:53Z) raised two points. Point 2 was this behaviour: "Could you create a new issue to fix it unless you think it's fine to
fix in this PR?" The fixer replied at 22:02Z (issuecomment-6670691212). It reproduced the behaviour and said it would file the issue and link it on #14335. The issue was filed at 22:47Z.
The triage memo for #14334 had already named "hull ignores `[[vk::location]]` on patch fields" as out of scope.
(Point 1 of the review, a regression in a void hull that writes global `out` variables, is fixed on #14335 itself. See [#14334](14334-hull-domain-patch-location-mismatch.md).)

**Content (the fixer's repro, not verified by Main).** The hull ignores the annotation: `n` 0 / `color` 1. The domain treats it as relative to the struct: with `PatchData` first, `n` 6 / `color` 5. With `OutputPatch` first, `n` 0 / `color` 6.
Code: `createPatchConstantFuncResultTypeLayout` (slang-ir-glsl-legalize.cpp:1198) and `SimpleScopeLayoutBuilder::endLayout` (slang-parameter-binding.cpp:3225).

**11-05 22:48Z: issue_opened, NO DISPATCH.** The memory grep had no hit on 14366. Live state: no assignees, no labels, no events. The issue is owned by
the #14334 chain (the fixer filed it on request). A fix needs a maintainer decision first: should an explicit Location on a patch field be absolute (like GLSL
`layout(location=N) patch out`) or relative to the struct? The decision changes front-end layout code that other stages share. **Parked: advisory:maintainer-decision.**
Resume when a human comments on #14366 or #14335, or when the decision is made. A fix would then be a new fixer chain (operator go).
