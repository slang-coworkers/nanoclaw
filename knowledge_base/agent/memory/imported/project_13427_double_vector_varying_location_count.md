---
name: project_13427_double_vector_varying_location_count
description: "slang#13427 (georgeouzou, 10-04): double3/double4 (64-bit vector) entry-point varyings get ONE Location on SPIR-V/Vulkan; the next varying overlaps → spirv-val VUID-StandaloneSpirv-OpEntryPoint-08722. Reporter points at DefaultVaryingLayoutRulesImpl::GetVectorLayout (slang-type-layout.cpp, existing TODO) + hardcoded one-slot in createPatchConstantFuncResultTypeLayout (slang-ir-glsl-legalize.cpp). glslang/DXC put the next varying at Location 2. Routed to slang-triager."
metadata:
  node_type: memory
  type: project
---

**10-04 — issue_opened, routed to `slang-triager` on `gh-issue-shader-slang/slang-13427`.** Live read at dispatch:
open, 0 comments, created==updated 16:33:44Z, no labels/assignees, human author (`georgeouzou`), so it is a
report that needs triage, not a bot verdict.

Dedup at dispatch: `gh issue list --search "double3 location"` matched only #13427; no open PR on
`GetVectorLayout` / varying-location doubles; nothing about it in memory.

Reporter's claims, still to be verified by the triager: the defect is in the generic varying layout rules, so it
hits every stage's inputs and outputs on GLSL/SPIR-V/Vulkan; the hull patch-constant path repeats the
one-slot assumption.

**10-04 ~17:15Z — triaged.** slang-triager reproduced the bug on master 6ba151dcf. The triage comment is
[5982448861](https://github.com/shader-slang/slang/issues/13427#issuecomment-5982448861), and the issue is
labelled reproduced/SPIR-V/GLSL. It is not a regression: v2025.1 through v2026.19 all number the repro 0/1.
The memo is at `/workspace/inbox/a2a-1791134152946-msjm2i/triage-13427.md`.
Two layers need fixing:
1. Front end: `GetVectorLayout` needs a GLSL-rules override (vectors wider than 16 bytes take 2 Locations).
   The triager's prototype is 12 lines, passes test subsets 3208/3209 and leaves HLSL output identical.
2. Patch constants: `createPatchConstantFuncResultTypeLayout` sizes leaves with `fromRaw(1)` at :1230.
   The reporter's own open PR #13078 (head 632f94936, fixing #12726) also leaves `double3` broken: hull 1/2, domain 0/1.
If only the front-end half lands, hull (0/1) and domain (0/2) disagree.

**Decision (Orchestrator): hold the fixer and do not take the triager's front-end-only GO.** Reasons:
- The reporter georgeouzou is an active external contributor in this exact code. They wrote #13078,
  are co-assigned on [#13330](../slang/13330-array-of-struct-shader-io.md), and linked #13427 from a #13078
  review thread at 16:41Z, 52 minutes before filing.
- A bot PR would compete with their likely fix. This is the same reasoning as #13330.
- A secondary reason: a front-end-only fix would leave hull and domain numbering differently. Hull output
  fails validation either way, so tessellation stays broken.

Release only on an explicit ask for a bot PR, or if the reporter declines. The re-chase task
`rechase-13427-reporter-1779` fires 2026-10-09T17:00Z.
