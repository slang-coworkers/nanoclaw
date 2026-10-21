---
name: project_13427_double_vector_varying_location_count
description: "slang#13427 (georgeouzou, 10-04; fixer HELD, operator decision pending since 10-16 (reminded 10-19), recheck rechase-13427-fourth-3f9b 10-22 defaults to hold): double3/double4 (64-bit vector) entry-point varyings get ONE Location on SPIR-V/Vulkan; the next varying overlaps → spirv-val VUID-StandaloneSpirv-OpEntryPoint-08722. Reporter points at DefaultVaryingLayoutRulesImpl::GetVectorLayout (slang-type-layout.cpp, existing TODO) + hardcoded one-slot in createPatchConstantFuncResultTypeLayout (slang-ir-glsl-legalize.cpp). glslang/DXC put the next varying at Location 2. Routed to slang-triager."
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

**10-05 18:02Z — handed to a maintainer.** jhelferty-nv assigned `tangent-vector`, who is now the only
assignee, and commented [6000173473](https://github.com/shader-slang/slang/issues/13427#issuecomment-6000173473):
*"@tangent-vector Can you comment on this one?"* The ping is from one human to another, so the bot does not
post. I sent nothing new to slang-triager because the hold is unchanged. The design call now belongs to
tangent-vector. Re-chase `rechase-13427-reporter-1779` (10-09 17:00Z) now also watches tangent-vector's
reply. If tangent-vector authorizes a bot PR, dispatch the triager first and do cleanup second (see
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]], #12462).

**10-07 18:33Z — maintainer direction.** tangent-vector commented
[6044320898](https://github.com/shader-slang/slang/issues/13427#issuecomment-6044320898):
- "yes, this is a bug". The fix applies to **all targets** whose counting rules make 64-bit scalars take
  two slots, and the full target range must be validated first.
- For D3D, vertex inputs and fragment outputs must match API-side binding; stage-to-stage locations
  don't matter there.
- The patch-constant fix is warranted but lower priority, with no refactor (they dislike that its layout
  is computed in IR legalization).
- There was **no ask for a bot PR**.

The comment does not literally mention @nv-slang-bot; the event came from the issue we triaged. I sent
slang-triager (msg 39) the comment verbatim and asked for the cross-target investigation, a short post,
and one closing question to tangent-vector about who opens the PR. The fixer stays held. #13078 moved
to head `3be5ee18c5` on 10-07.

**10-07 19:44Z — cross-target sweep posted.** The triager posted
[6045519879](https://github.com/shader-slang/slang/issues/13427#issuecomment-6045519879) (1627 chars; I verified it at source).
- Only SPIR-V/GLSL need the 2-slot count.
- D3D: DXC rejects 64-bit VS inputs and PS outputs, and DXGI has no R64 VS/RT formats.
- Metal: `long4` gets 1 index, and `double` hits an internal error.
- WGSL/C++/CUDA: these varyings fail to compile.
- The fix site is `GLSLVaryingLayoutRulesImpl` only.
- #13078 @ `3be5ee18c5` still fails `double3` (leaf `fromRaw(1)` at :1276).

The comment ends with one question to @tangent-vector: should the bot open the PR, or will they or @georgeouzou?

Side findings I held:
- (a) A 64-bit `SV_Target` compiles with no diagnostic. This is already disclosed in that comment, so I
  filed no separate issue.
- (b) In #13078, hull patch-constant Locations start after the control-point outputs, so a float3 gives
  hull 1/2 vs domain 0/1 (DXC 0/1). I did not post it: it would be an unsolicited review on a community
  PR under human review. Offer it to georgeouzou if the patch-constant half is routed to #13078.

`SV_Target3` → Location 1 is the existing #11944.

**10-09 17:00Z — first re-chase, silent.** No comments on #13427 since 6045519879, no cross-referenced PRs,
and tangent-vector is still the sole assignee. Nobody answered the PR-ownership question. #13078 moved to
`ed12c49ccf` (10-07 21:40Z refactor, relative patch-constant offsets). It is still open, and the leaf is still
`fromRaw(1)` (~:1273), so double3 stays unfixed there. The fixer stays held. Re-armed once as `rechase-13427-second`
(2026-10-16T17:00Z). If that run is silent too, ask the operator (consistent with #13330's 10-13 ask, same contributor).

**10-16 17:00Z — second re-chase, silent again.** #13427: no comments since 6045519879 (10-07), no
cross-referenced PRs besides #13078's 10-04 link, and tangent-vector is still the sole assignee. #13078: jhelferty-nv
APPROVED it 10-13 19:35Z and auto-merge is armed, but it is DIRTY (conflicts) at head `21d30ae0a8` (10-10). The
leaf is still `fromRaw(1)` (:1299), so double3 is still unfixed. The new struct/array/matrix sizing does not touch
64-bit scalars. The operator never answered the 10-13 #13330 ask (dashboard seq 500530), so I had no decision to
copy. My `ask_user_question` (timeout 0) aborted at the 1800 s MCP idle limit again. I re-asked on
`orchestrator-dashboard` (msg 45, thread `gh-issue-shader-slang/slang-13427`) with 1 = re-ping tangent-vector,
2 = hold +14d, 3 = release fixer for a draft PR. The fixer stays HELD. One-shot `rechase-13427-third-9d1e` fires
2026-10-19T17:00Z and acts on the answer.

**Cross-link (10-16 21:10Z, from #13330 re-chase 3):** #13078 was force-pushed to `b7c4b3d9be` at 10-16 19:19Z, which dismissed
jhelferty-nv's approval and turned off auto-merge. The #13330 operator ask is still unanswered. Its reminder (dashboard id 9, thread
`gh-issue-shader-slang/slang-13330`) says one answer covers both chains. Before reading #13078's leaf for `double3`, re-check it at the
new head.

**10-19 17:00Z — third re-chase, silent; operator reminded.** The operator still has not answered. The dashboard rows from seq 505392
to 506008 contain only my 10-16 ask (505398) and the #13330 reminder (505464); nobody chose 1, 2 or 3. #13427: no comments since
6045519879, no new cross-referenced PRs, and tangent-vector is still the sole assignee. Rules A–C did not apply. **#13078:** georgeouzou
commented on 10-19 at 16:12Z ("pushed again, because the pr had merge issues"). jhelferty-nv **re-approved it at `b7c4b3d9be` at 16:18Z
and re-armed auto-merge at 16:20Z**. It is MERGEABLE/BEHIND, so it will probably merge soon. Its leaf is still `fromRaw(1)` at :1299, and its
diff has no 64-bit/`GetVectorLayout` change, so this is not rule B. I sent ONE reminder to `orchestrator-dashboard` (id 9, thread
`gh-issue-shader-slang/slang-13427`). It notes that once #13078 merges, a bot PR would no longer overlap with georgeouzou's open PR. The fixer stays
HELD. **One-shot `rechase-13427-fourth-3f9b` fires 2026-10-22T17:00Z.** If that run is silent too, it sends no more reminders. It defaults
to **hold** (+14d one-shot) and sends one line saying so, which matches #13330's `rechase-13330-fourth-e68c`. That default is my choice; the
operator did not set it.

**Cross-link (10-20 21:05Z, from #13330 re-chase 4):** no operator answer for either chain in dashboard rows up to 506432 (10-20 20:52Z).
**#13078 MERGED 10-19 23:47Z** at `b7c4b3d9be`. Re-check its merged leaf for `double3` before acting, because the PR-overlap argument for holding is gone.
#13330 took the default hold (one line on `orchestrator-dashboard` id 15). Its next check is `rechase-13330-fifth-e954` (11-03).
