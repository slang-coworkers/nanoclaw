---
type: chain
title: slang#13330 — array-of-struct shader IO field crashes SPIR-V/GLSL
description: Triaged + reproduced; two defects in legalizeEntryPointsForGLSL; fixer HELD (reporter co-assigned); operator 3-way ask unanswered since 10-13; default hold applied 10-20; next check 11-03
tags: [slang, spirv, glsl, varying-legalization, parked]
resource: /workspace/inbox/a2a-1790714475432-85ez5y/triage-13330.md
---

# slang#13330 — array-of-struct shader IO (parked)

Reporter georgeouzou (external). `struct VSOut { float4 pos : SV_POSITION0; Nested n[2] : NESTED_ATTR; }`
→ `-target spirv` E99997 (`void_constant` in spirv-emit), `-target glsl` E99999. HLSL/Metal/WGSL
compile. Not a regression (2025.23.2/2025.24 segfault).

**Mechanism (triager; its posted comment matches):** `legalizeEntryPointsForGLSL` SoA-splits
`Nested n[2]` into `n.a:float[2]`, `n.b:float[2]`.
1. Output crash: `assign()` (slang-ir-glsl-legalize.cpp:2604) → `extractField` on an array value hits
   the PR #10283 null guard (:2352) → empty value → `store(…, void_constant)`. The per-element fix
   (aa3217fa6) was dropped before merge (f6e762fc2).
2. New, not in the report: the input side emits overlapping Locations (a@0, b@1, each float[2]), which
   spirv-val rejects (08721). The field offset (:2216-2223) is not scaled by the array count.
   Reflection and DXC are element-major.
Both have to be fixed together. Recommended A (array-aware write + loud failure) + B1 (per-element-
per-field vars, element-major); B1 vs B2 (one DXC-style `Nested[2]` varying) is for the maintainers.

**State 2026-09-29 ~20:41Z:** triage comment
[5898420450](https://github.com/shader-slang/slang/issues/13330#issuecomment-5898420450); labels
`reproduced`, `SPIR-V`, `GLSL`; milestone Q4 2026 (Fall). Assignees: jhelferty-nv **and the reporter
georgeouzou**, who was co-assigned after my 20:16Z read. slang-fixer HELD with an A+B1 briefing.

**Decision (Orchestrator): hold the fixer.** A maintainer co-assigning an external reporter signals the
reporter may send the fix. A bot PR would compete with it (assigned-human stand-down rule).
Release only on an explicit ask for a bot PR, or if the reporter declines.

**Re-chase 1 (2026-10-06T21:00Z, `rechase-13330-assignee-c133`): no change.** No comments, no #13330 PR,
same assignees. One signal: the reporter's separate open PR #13078 (hull patch-constant outputs, Fixes
#12726) adds a TODO in `createPatchConstantFuncResultTypeLayout` that points at #13330 ("take this case
into account when fixing it"). So the reporter knows about it but hasn't committed to a PR. jhelferty-nv
pinged them on #13078 on 10-06. Dashboard told. **Re-chase 2 `rechase-13330-second-f513` fires
2026-10-13T21:00Z.** If that one is also silent, it asks the operator (ask_user_question) whether to ask
on the issue.

**Re-chase 2 (2026-10-13T21:00Z, `rechase-13330-second-f513`): silent again.** No comments, no #13330 PR,
same assignees. #13078 was APPROVED by jhelferty-nv at 10-13 19:35Z and is about to merge (desc updated 20:10Z,
BEHIND master). It didn't take on #13330 scope beyond the TODO, so the reporter will be free soon.
I sent the operator a 3-way ask (ask on issue via triager / hold +14d / release fixer). The `ask_user_question`
(timeout 0) aborted at the 1800 s MCP idle limit, so in practice timeout 0 means 30 min. The ask went
to `orchestrator-dashboard` msg 9, thread `gh-issue-shader-slang/slang-13330`. Fixer is still HELD.
**One-shot recheck `rechase-13330-third-94a1` fires 2026-10-16T21:00Z.** It acts on the operator's answer.

**Re-chase 3 (2026-10-16T21:00Z, `rechase-13330-third-94a1`): no answer, nothing new (case e).** The dashboard rows
from 500501 to 505456 (10-13 20:16Z to 10-16 20:52Z) have no operator reply on #13330. The only hits are my ask (seq 500530)
and the #13427 ask (505398). #13330 has no comments since 09-29, no PR, and the same assignees. **#13078 changed:** georgeouzou
force-pushed it to `b7c4b3d9be` on 10-16 at 19:19Z (5 commits, still Fixes #12726). That push **dismissed jhelferty-nv's approval and
turned off auto-merge**, so the PR is not merged and needs a new approval. The #13330 TODO is still in it and it has no #13330 scope.
I sent ONE reminder to `orchestrator-dashboard` (id 9, thread `gh-issue-shader-slang/slang-13330`) that also says one answer covers
#13427. The fixer stays HELD. **One-shot `rechase-13330-fourth-e68c` fires 2026-10-20T21:00Z.** If that run is silent too, it
sends no more reminders. It defaults to **hold** (+14d one-shot) and sends one line saying so. That default is my choice; the operator
did not set it. A third unanswered reminder would just add noise.

Unverified side note (triager, not posted): WGSL/Metal emit `array<Nested,2>` user IO, likely invalid there.

**Cross-link (10-16 17:35Z, from the #13427 chain):** #13427 has the same contributor (georgeouzou) and the same
silent PR-ownership question. Its operator ask went to `orchestrator-dashboard` msg 45 (thread
`gh-issue-shader-slang/slang-13427`) and has not been answered either. If the operator answers one of the two, apply
a consistent decision to the other; see [13427 record](../imported/project_13427_double_vector_varying_location_count.md).

**Cross-link (10-19 17:05Z, from #13427 re-chase 3):** jhelferty-nv re-approved #13078 at `b7c4b3d9be` on 10-19 at 16:18Z and re-armed auto-merge.
It is MERGEABLE/BEHIND, and it still has no #13330 scope. The #13427 operator ask is still unanswered. Its reminder went to `orchestrator-dashboard`
(id 9, thread `gh-issue-shader-slang/slang-13427`). Its `rechase-13427-fourth-3f9b` (10-22) defaults to hold, the same as this chain.

**Re-chase 4 (2026-10-20T21:00Z, `rechase-13330-fourth-e68c`): third unanswered round (case e), so I applied the default hold.** The dashboard
rows from 505458 to 506432 (10-16 21:01Z to 10-20 20:52Z) have no operator reply on #13330 or #13427. The only hits are my 10-16 reminder
(505464) and the #13427 reminder (506014). #13330 has no comments since 09-29, no new timeline events, and the same assignees (georgeouzou,
jhelferty-nv). **#13078 MERGED at 10-19 23:47Z** (`b7c4b3d9be`, Fixes #12726). It still only has the #13330 TODO and no #13330 scope.
georgeouzou now has no open PRs, so a bot PR would not overlap any of their work. I sent no reminder. I sent ONE line to
`orchestrator-dashboard` (id 15, thread `gh-issue-shader-slang/slang-13330`). The fixer stays HELD. **One-shot `rechase-13330-fifth-e954`
fires 2026-11-03T21:00Z.** Its case (e) parks the chain indefinitely, with no more re-checks. Webhooks deliver any new comment.
