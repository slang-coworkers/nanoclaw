---
type: project
name: project_13934_metal_clip_cull_distance_empty_attribute
description: "slang#13934 (bot-filed 10-25 08:34Z by slang-triager, side finding (1) of #13931): Metal emits an empty [[]] attribute on SV_ClipDistance/SV_CullDistance vertex outputs (scalar + array), and no attribute at all on a fragment-input clip distance. Cause: LegalizeMetalEntryPointContext ClipDistance/CullDistance cases set only isSpecial; ensureStructHasUserSemantic adds systemValue \"\". Routed by this issue's own Main to slang-fixer 10-25 ~08:40Z on gh-issue-shader-slang/slang-13934; draft PR #13940 opened 11:02Z (head e83b5029de)."
---

# slang#13934: Metal `[[]]` on clip/cull-distance outputs

**10-25 08:34:22Z `issue_opened`.** Main webhook session `sess-1792917264666-aahhvp` (thread
`gh-issue-shader-slang/slang-13934`). Live read: open, 0 comments, `reproduced`, Type Bug, unassigned;
timeline = bot label/type + cross-ref from #13931 (08:34:44Z).

**Ownership ladder:** filed by slang-triager on the #13931 Main's order (rai1tj row 27: "file it as its own
issue"; no "no fixer" order). Triager close-out (rai1tj row 32) left routing to this issue's Main, the same
pattern as #13729/#13730. No other session on the thread; no task names it; dashboard rows hold no order.

**Overlap check:** three non-draft PRs by albertrodriguezclo touch `slang-ir-legalize-varying-params.cpp`:
#13925 (fragment return semantic, Metal context), #13926 (dual-source blending, near
`ensureStructHasUserSemantic` + Metal context), #13930 (WGSL clip_distances). None maps Metal
ClipDistance/CullDistance. #13922 is emit-metal interpolation only. Same author is active in this area, so
the fixer was told to stop and report if a PR naming #13934 or Metal clip_distance appears.

**Decision:** dispatched to slang-fixer (draft PR). Scope: ClipDistance -> `clip_distance` for vertex/mesh
outputs (scalar + float[N]; check MSL accepts it on `array<float,N>` or needs a C array), CullDistance -> E55202,
fragment-input clip distance mapped only if MSL defines it, else diagnosed; no silent empty name in
`ensureStructHasUserSemantic`. Vector form is out of scope (depends on #13931).

**08:38Z slang-fixer claimed** (sentinel active-work/slang-13934); at claim time no PR named #13934 and no Metal clip_distance PR was open.

**09:40Z fixer progress (their report):** 8 local commits. MSL `[[clip_distance]]` takes only `float`/`float[n]`, so arrays are emitted as a C array `float x [[clip_distance]] [N]` with element-wise writes. Two clip outputs give a new E55219 (free on master 52e29ab43 and in #13922/#13925/#13926/#13930). Cull and fragment-input clip give E55202. Mesh outputs use a Metal-only vertex struct. Full suite running, PR next. Main asked for E55219 to be worded as a not-yet-supported limit pointing at #13931 packing, since `SV_ClipDistance0`+`SV_ClipDistance1` is valid HLSL.

**11:02Z draft PR [#13940](https://github.com/shader-slang/slang/pull/13940) opened** (verified live 11:08Z): branch `fix/issue-13934`, head `e83b5029de`, 8 commits, 11 files +621/−12 (`slang-ir-legalize-varying-params.cpp` +264, emit-metal, emit-c-like, lower-out-parameters, diagnostics.lua, Metal user-guide doc, 2 tests). Closes #13934, `pr: non-breaking`. E55219 is worded "not yet supported on Metal" (asked for 09:40Z). Explanation comment 6396818973; pr-mapping goes to fixer session `sess-1792917514958-ssft3l`. CI shows the draft gate (4 pass / 53 skipping). The fixer reports full suite 11189/11192 (3 CUDA fp8 failures also on master). #13934 has no issue comment; the PR is the artifact.

**11:08Z label call (Main's decision):** the fixer asked about `pr: non-breaking`. The PR now errors on Metal for cull, fragment-input clip (including a struct shared as VS-out and PS-in) and multiple clip outputs, all of which compiled before. `[[]]` is a legal empty C++ attribute list, and no Metal compiler was run, so 'it was invalid before' is unproven. By the repo rule (it errors on existing code), I told the fixer to switch to `pr: breaking change` and list the newly-erroring cases in the body. Fixer CI run 40187187860; [Fix Review Request] went to slang-reviewer. Alternative for a maintainer to choose: SPIRV-Cross's default `enable_clip_distance_user_varying` mirrors clip distance as a user varying, so a fragment can read it. Raise it in the explanation comment; it is not in this PR.

**11:28Z, head `fd32959fdb` (verified live):** relabeled `pr: breaking change`. The body (1013 chars) lists the new Metal errors and names #13931. The explanation comment cites SPIRV-Cross `enable_clip_distance_user_varying` (default true, spirv_msl.hpp:420) as prior art, in plain text. ⚠️ **Overlap with draft #13939** (#13931 fixer, session `utji1s`, head `3d18cf8426`): #13939 also adds E55219, so #13940 moved to **E55220**. Both edit the Metal ClipDistance/CullDistance case in `slang-ir-legalize-varying-params.cpp`. Whichever merges second combines them (`clip_distance` + `isOutputOnly`, plus #13939's `isVectorTypedVarying(parentVar)` check). At 11:30Z neither PR body named the other. Main asked the #13940 fixer to add a plain-text cross-reference on #13940. Done 11:31:46Z in explanation comment 6396818973; #13939 timeline shows cross-referenced from #13940 (11:31:47Z, verified).

**12:45Z slang-reviewer verdict @ fd32959: REQUEST_CHANGES (small)** — 0 bugs, 5 gaps, 3 questions; not posted (not authorized); sent to fixer too. Top concern: `half clip [[clip_distance]]` emits invalid MSL with no diagnostic. Also, on a trial merge with #13939, a mesh `float2` clip does the same: the mesh string compare at `:5039` is a gap. The reviewer has a tested remedy. Test gaps: half → E55202, mesh E55220, scalar mesh, and a `-NOT` check for whole-array stores. Reconciliation: keep `field`, not `key` (a key's type is null → `getIRVectorElementSize(nullptr)`). Devin's mesh-primitive cull "bug" also happens on master. Full suite 10970/10973 (CUDA fp8 failures also on master). Report: `/workspace/inbox/a2a-1792932313444-1ec4ix/combined-review.md`.

**12:46Z fixer: round 1 in progress.** It is applying L1 (mesh classification via `getSystemValueInfo`) and L2 (`half` → E55202) and adding the missing tests. It asked Main for two calls. **Main's decisions (12:50Z):**
- **Q2**, Metal mesh `OutputPrimitives` SVs other than SV_PrimitiveID silently dropped (pre-existing on master): out of #13940's scope. The fixer files ONE follow-up for the class after confirming it on TOT and deduping. My quick search ("metal mesh primitive", "SV_CullPrimitive metal") found nothing. No fixer; its issue_opened Main routes it.
- **Q3**, #13939 `Fixes #13931` would leave E55220 with no tracker: the fixer files a dedicated Metal clip-distance packing issue, worded as a missing feature, not a regression. It is parked until #13939 and #13940 merge. #13940's explanation comment names it. Whether #13939 keeps `Fixes #13931` is the #13931 chain's call; I flagged it to the operator and did not message that chain (not my edge).

**12:59Z code collision #2:** #13939 head `ba4db451b7` now adds E55219 and E55220 (`clip-cull-distance-array-mixed-with-other-values`), so #13940 moves to **E55221**. Allocation: #13939 has 55219–55220, #13940 has 55221. Main sent a peer FYI to the #13931 fixer session (`utji1s`, thread `gh-issue-shader-slang/slang-13931`) saying it should take 55222+ if it needs more. **Correction to my 12:50Z brief (verified in the diff):** #13939 reports Metal vector clip distances as **E55202** (`isUnsupported = isVectorTypedVarying(parentVar)`), not E55219; E55219 is its GLSL/SPIR-V arrayed-varying error. #13939's comment at that case cites #13934 as the Metal tracker, and it goes stale once #13940 maps scalars. Whichever merges second rewrites it.

**13:11Z filed (verified live):** [#13946](project_13946_metal_mesh_per_primitive_system_values.md) (Q2, Bug) and [#13947](project_13947_metal_clip_distance_packing.md) (Q3, Feature). Both parked, no fixer. #13940 head `c38538f3e0` (E55221). Round-2 review request is next.

**13:22Z round-1 edits pushed (fixer's numbers):** de026f3 has the round-1 edits; c38538f moves the error to E55221. New tests 19/19, with 6 metallib runs ignored on Linux. Full suite on de026f3: 11194/11197 (the CUDA fp8 failures also seen on master). On c38538f only metal/wgsl/diagnostics ran: 1277/1277. Body and explanation comment are refreshed and cite #13946/#13947. The breaking list adds a nested `SV_InnerCoverage` stage_in member (now E55202, was `[[]]`). Round 2 is in review.

**13:58Z round-2 verdict @ c38538f: APPROVE_WITH_NITS** (0 bugs / 0 gaps / 4 nits). Nits: the mesh `else` also admits cull keys, the `half` diagnostic wording, one dead `-NOT`, and the #13947 citation. Full suite 10975/10978 (the CUDA fp8 failures also on master). A trial merge with #13939 builds; only #13939's WGSL test annotations need to move. Not posted. Report: `/workspace/inbox/a2a-1792936682059-5qqade/combined-review.md`.

**14:09Z [Fix Report] (verified live 14:12Z):** draft #13940 at `2bfef77a33`, 12 commits, 11 files +835/−18, `pr: breaking change`, 0 behind master, 0 GitHub reviews; the explanation comment was refreshed for head 2bfef77. Code CI: run 40187187860 on e83b502 **succeeded**; dispatched runs on fd32959/de026f3/c38538f were cancelled (superseded); run 40200445035 on 2bfef77 is `waiting`. Round-2 nits N1/N3/N4 applied; N2 (`half` type diagnostic) declined for consistency with #13939's E55202. #13934 has 0 issue comments; the PR is the artifact. The fixer flagged that #13946's body misses the reviewer's nested-struct-in-mesh-vertex clip-distance drop (pre-existing). **Main: the fixer adds ONE plain-text repro comment on #13946.**
**Un-draft ask #1** went to orchestrator-dashboard at ~14:15Z. Timer: one-shot `rechase-13940-undraft-360f` (2026-10-28T14:30Z, 72h cadence).

**Resume on:** operator un-draft answer; a human review or comment on #13940/#13934; the re-chase task / reviewer verdict; operator un-draft call; an external PR naming #13934.
