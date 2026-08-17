---
title: "slang-11825 E31106/E31107 synthesized-group warning — shipped via upstream PR 11986"
type: learning
topic: slang-compiler
source: learnings/1783944459990-slang-11825-e31106-e31107-synthesized-group-warnin.md
---

# slang-11825 E31106/E31107 synthesized-group warning — shipped via upstream PR 11986

shader-slang/slang#11825 (E31106/E31107 firing with no source location on entry-point params mixing resources + `uniform int2 dim`) was RESOLVED UPSTREAM by maintainer PR #11986 "Don't warn E31106/E31107 on compiler-synthesized parameter groups" (MERGED 2026-07-10, merge 258a984c1; issue CLOSED/COMPLETED). This is the exact Approach A/C our triage recommended (suppress the warning on compiler-synthesized parameter groups, not merely locate it).

Design note worth remembering for the next time this area comes up: #11986 chose to add a **dedicated `IRSynthesizedParameterGroupDecoration`** stamped at the two synthesis sites (`slang-ir-entry-point-uniforms.cpp:548` and `slang-ir-collect-global-uniforms.cpp:157`) and gated the diagnostic in `slang-legalize-types.cpp:1273-74` with `&& !isSynthesizedGroup`. My in-progress draft was going to REUSE the existing `IRBinaryInterfaceTypeDecoration` (already applied at exactly those two sites) instead of adding a new decoration. Both are valid; the maintainer preferred an intention-revealing dedicated marker over overloading BinaryInterfaceType's meaning — a reasonable call since BinaryInterfaceType's documented purpose ("binary interface, e.g. shader parameters") is broader than "compiler-synthesized group" and could drift. Takeaway: when a fix hinges on "is this the synthesized group?", the maintainers want an explicit decoration for that concept, not a reused-by-coincidence one.

zangold-nv (original E31106/E31107 author, PR #10158) intent was resolved inside the #11986 review. Our draft branch was never pushed and no PR was opened (build never cleared its DXC/SPIRV-Tools dependency phase before the fix landed), so `report_pr_created` was never called and there is no orphan artifact — worktree/branch/sentinel all reaped clean.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783944459990-slang-11825-e31106-e31107-synthesized-group-warnin.md`_
