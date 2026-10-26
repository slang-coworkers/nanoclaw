---
type: project
name: project_13931_sv_clipdistance_vector_form
description: "TRIAGED 08:31Z (bug/regression/medium/P2, Approach A in slang-ir-glsl-legalize.cpp), slang-fixer claimed 08:32Z; Metal side finding filed as #13934. Draft PR #13939 @ ba4db451b, Fix Report 13:34Z after R2. PARKED on maintainer review (jhelferty-nv) + un-draft + CI approval gate; timer recheck-13939-maintainer-108f 10-28 14:00Z. Dispatched to slang-triager 10-25 ~08:25Z on gh-issue-shader-slang/slang-13931. slang#13931 (albertrodriguezclo, external): HLSL vector-form clip distances (float4 SV_ClipDistance0 + float2 SV_ClipDistance1) rejected with E30701 on every target; asks to pack them into the target clip-distance array as DXC does. No author PR names it; sibling PR #13930 (WGSL float[N] -> clip_distances) explicitly leaves the vector form out of scope."
---

# slang#13931: `SV_ClipDistance` vector form (`SV_ClipDistance0/1`) rejected with E30701

**10-25 08:22:00Z `issue_opened`.** Main webhook session `sess-1792916522957-rai1tj`. Live read: open,
0 comments, no labels, unassigned, `updated_at == created_at` (never edited).

**Report (not verified by us):** `float4 clip0 : SV_ClipDistance0; float2 clip1 : SV_ClipDistance1;` is
accepted by `dxc -T vs_6_0`; Slang (v2026.20, master 52e29ab43) gives
`E30701 type 'vector<float,4>' is not valid for system value semantic 'SV_ClipDistance'` on every target.

**Ownership check.** Same author filed issue+PR pairs all morning; none of the author's PRs (#13908-#13930)
names #13931. PR #13930 (08:21:58Z, "WGSL: map an SV_ClipDistance array to the clip_distances built-in")
covers only `float[N]` on WGSL and says the scalar/vector forms stay unsupported because of this same E30701.
Not a design question to maintainers, so it follows the #13916 path (triage), not #13913/#13914 (hold).
R6 gate slang-coworkers/nanoclaw#1993 still draft 10-25, so no 4-day wait.

**10-25 08:25Z triager interim (their finding):** E30701 reproduced on all 5 targets; DXC vs_6_0 accepts and packs CLIPDST idx0 xyzw + idx1 xy. Researching front-end check, per-target lowering, overlap with #13930. 08:25Z: that repro was on a local Release slangc 556 commits behind master; triager is rebuilding 52e29ab43 to re-confirm on top-of-tree.

**10-25 08:31Z [Triage] (triager's findings; memo `/workspace/inbox/a2a-1792917112900-84bqzt/triage-13931.md`):**
regression (HLSL path) + missing SPIR-V/GLSL packing / medium / frontend + target-emit / P2. Reproduced on TOT
52e29ab43, all 5 targets (the "stale" Release build was HEAD, so no rebuild was needed). v2026.1.1 compiled it, and GLSL/SPIR-V
silently dropped lanes. #9260 (3e0357872) declared `sv_clipdistance`/`sv_culldistance` as float/float[] only
(core.meta.slang:5166-5210). Recommended **A**: relax core.meta and add an offset pre-pass in slang-ir-glsl-legalize.cpp
(TODO at :1834), using DXC's GlPerVertex.cpp rule (sorted indices, running width sum). No file overlap with #13930;
WGSL vectors need #13930 first. Side findings: (1) Metal emits an empty `[[]]` attr on all clip/cull outputs.
Main told the triager to dedup it (also against #13922/#13925/#13926), confirm on TOT, and file it. (2) Scalar
SV_CullDistance0/1 collides on GLSL; it stays in #13931's scope and is covered by A, so it is not filed separately.
**08:32Z slang-fixer claimed** (worktree wt-slang-13931 @ 52e29ab43, Debug build). At 08:33Z the GitHub triage
comment and labels were not yet visible; Main asked the triager for the comment id.

Verified live afterwards: triage comment 6395442590 (nv-slang-bot, 08:32:38Z); labels `regression` + `reproduced`; type Bug; one slang-fixer session on the canonical thread.

**08:35Z triager [Report] close-out, verified live:** side finding (1) was filed as **#13934**, "Metal: SV_ClipDistance / SV_CullDistance outputs are emitted with an empty [[]] attribute" (nv-slang-bot 08:34:22Z, `reproduced`, Bug, no @-mentions). Its own issue_opened Main owns routing; the triager filed it, so there is no fresh triage. Comment 6395442590 was edited at 08:34:43Z and now names #13934 and the CullDistance scope. The triager is waiting for the fixer's [Fix Report].

**10-25 10:27Z fixer opened draft PR #13939** (`fix/issue-13931`, head 3d18cf842, "Support vector SV_ClipDistance/SV_CullDistance and fix scalar cull-distance collisions"). At 10:42Z the fixer sent a [Fix Review Request] to slang-reviewer (`sess-1792924928311-j7u3hn`, on the canonical thread).
**11:23Z R1 REQUEST_CHANGES** (reviewer's findings; file `/workspace/inbox/a2a-1792927386928-btw14i/combined-review-13939-r1.md`). The top finding is a silent miscompile: with `float c[2] : SV_ClipDistance0` and `float2 d : SV_ClipDistance2`, `d` overwrites `c`, because the pre-pass skips array leaves (:524). The second is a release-mode `SLANG_ASSERT` in the new `getSubscriptVal` arrayIndex case (:3079), reachable from a hull shader with no `[outputcontrolpoints]`. Test gaps: E55219 outside mesh shaders, FS cull inputs, and the multi-element `adaptType` branch. The fixer got it (fixer seq 16/18). No GitHub post, since there was no post marker and the PR is a draft.

**10-25 11:30Z, seen from the #13934 chain:** #13931's draft PR is **#13939** (head `3d18cf8426`, fixer session `utji1s`). It adds E55219 and edits the Metal ClipDistance case, which overlaps draft #13940 (#13934, now E55220). Merge-order detail is in [project_13934](project_13934_metal_clip_cull_distance_empty_attribute.md).

**12:16Z reporter comment 6397520622** (live body matches the payload; no @-mention, so it is not a bot summons). The reporter confirms they have no PR for #13931 and that #13939 is the fix. #13939 and their #13930 both touch `slang-ir-legalize-varying-params.cpp` (contrary to triage's "no file overlap": #13939 added a Metal change there). Whichever lands second gets rebased. After both land, the reporter will extend WGSL to the vector form. Main forwarded it to the fixer as FYI only, with no GitHub reply asked. PR head was 34759c02e (draft) at 12:17Z. At 12:18Z the fixer reported (checked live) the R1 fixes pushed in 34759c02e with CI 40191415298, the PR description scoping WGSL vectors out until after #13930, and R2 review running since 12:03Z, which is the last round.

**12:50Z R2 REQUEST_CHANGES (small)** @ 34759c02e (reviewer's findings; file `/workspace/inbox/a2a-1792932634316-pu6xwp/combined-review-13939-r2.md`). The bug: a dynamic index on a `half2` clip/cull FS input emits `gl_ClipDistance[4 + i]` on an unsized, undeclared GLSL input array (:3166). The gap: no tests for domain outputs, tessellation-patch E55219 or struct-typed FS input, and HALFOUT doesn't check the right-hand side. The reviewer includes two tested remedy patches. In the [Review Verdict] the top concern is a regression: new E55220 rejects a two-stream GS that shares one `float clip[2]` struct, which compiled to valid SPIR-V on base. The `half2` bug is from R1, and glslang rejects that output loudly. The R1 items are verified fixed. The fixer got it (fixer seq 24). R2 was the last round, so a [Fix Report] comes next.

**10-25 13:34Z [Fix Report], checked live:** draft PR #13939 at head ba4db451b, +1179/−55 across 8 files. It adds E55219 (vector in an arrayed varying) and E55220 (`float[N]` sharing a signature with other values of the same semantic), plus a user-guide SPIR-V section. The fixer reports 34 new test variants (30 fail on master) and a full suite of 10990/10993 (3 fp8-cuda failures that also fail on base). All R2 items are applied and the unreachable `getSubscriptVal` case is removed. Still open: nonblocking clarity items, plus N2 (duplicate hull E55219). Shepherd jhelferty-nv is assigned and review is requested. Explanation comment 6396557152 was refreshed for head ba4db45 and carries an open question for maintainers: should all-scalar signatures with index gaps be compacted like DXC? **CI run 40195442980 is `waiting` at the approval gate**: only board-sync, reuse, CLA and CodeRabbit ran, so GitHub CI has not yet tested the change.

**PARKED** on maintainer review + human un-draft (ready_for_review is human-only by norm) + CI approval. Timer: one-shot `recheck-13939-maintainer-108f` set for 10-28 14:00Z. Operator told on orchestrator-dashboard 10-25 13:3xZ.

**Resume on:** a human review or comment on #13939/#13931 (webhooks route to the fixer through the pr-mapping), #13930 landing (then merge master, never rebase), or the timer.

Siblings: [#13916](project_13916_wgsl_atomic_vec2u_min_max.md), [#13924](project_13924_wgsl_metal_fragment_return_semantic.md).
