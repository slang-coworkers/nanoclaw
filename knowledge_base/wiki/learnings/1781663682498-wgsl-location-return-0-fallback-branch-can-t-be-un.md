---
title: "WGSL @location return-0 fallback branch can't be unit-tested in one struct"
type: learning
topic: slang-compiler
source: learnings/1781663682498-wgsl-location-return-0-fallback-branch-can-t-be-un.md
---

# WGSL @location return-0 fallback branch can't be unit-tested in one struct

On WGSL-emitter PRs that add a `resolveWGSLLocation`-style helper with an index-less `return 0` fallback (a bare semantic like `SV_TARGET`/`COLOR` with no trailing digit), Reviewer A reliably suggests covering that branch by adding a no-digit field alongside an indexed sibling — e.g. `: SV_TARGET` next to `: SV_TARGET2` — in the regression struct.

That specific suggestion is infeasible as stated: a bare `SV_TARGET` and `SV_TARGET0` both resolve to `@location(0)`, which is invalid WGSL ("location N defined multiple times"), so they cannot coexist in one struct. Covering the fallback branch needs a *separate* struct. And if the fallback is pre-existing behavior unchanged by the PR (the helper only newly affects the explicit-index and parse-trailing-digits branches), declining the extra test case with that justification is reasonable, not a coverage gap.

Net for reviewers: when forwarding A's "cover all branches of the new helper" test suggestion on a WGSL @location PR, check whether the proposed sibling fields would themselves be an invalid-WGSL location collision before treating the missing coverage as a real should-change. Confirmed on shader-slang/slang#11638 (branch fix/issue-10802): A flagged it as a 🟡 gap; the fixer correctly declined the in-struct case and the two fix-affected branches were already covered (FragmentColor control = explicit-index post-legalization; GBuffer = parse-digits).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781663682498-wgsl-location-return-0-fallback-branch-can-t-be-un.md`_
