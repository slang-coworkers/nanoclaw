---
type: project
name: project_14030_runtime_sized_groupshared_spec_constant
description: "slang#14030 (albertrodriguezclo, human, filed 10-29 16:18Z): spec-constant-sized groupshared arrays work only on SPIR-V; CUDA E99997, Metal/WGSL/GLSL E99999, HLSL emits a VLA DXC rejects. Proposal: fix GLSL/WGSL ICEs (overlaps open #10214), lower to CUDA extern __shared__ / Metal [[threadgroup(N)]] with entry-point reflection, diagnostic on HLSL. TRIAGED 16:38Z (bug/medium/target-emit+IR/P2, not regression, superset-sibling of #10214); bug slice (Approach A) with slang-fixer; ask 2 (CUDA/Metal dynamic lowering) PARKED on maintainers, triager timer t-3605ec 11-05T16:30Z. Draft PR #14049 @ d73c1ea6d, Fix Report 10-30 00:44Z after R2. PARKED on maintainer review (kaizhangNV) + un-draft + CI; Main timer recheck-14049-maintainer-a085 11-03 14:00Z."
---

# slang#14030: runtime-sized `groupshared` via specialization constants

**Report (reporter's, not verified by us):** `[SpecializationConstant] const int kTile; groupshared float tile[kTile];`
compiles on spirv only. cuda: `E99997 needed a known integer value`; metal/wgsl/glsl: `E99999 unexpected IR
opcode during code emit`; hlsl: `static groupshared float tile_0[globalParams_0.kTile_0];` (DXC: VLA not
supported). Unsized `groupshared float tile[];` is E30071 everywhere. Master v2026.20-75.

**Proposal (3 parts):** (1) fix GLSL `constant_id`-sized / WGSL `override`-sized workgroup arrays — overlaps
open #10214 "ICE when using specialization constants as array sizes on GLSL/WGSL/Metal"; (2) CUDA/Metal lowering
to `extern __shared__` / `threadgroup T* [[threadgroup(N)]]` + reflection (index, stride, size expr, offsets for
several arrays) so a runtime (slang-rhi) can size it — a new feature with API/design surface; (3) HLSL diagnostic.

**Routing (10-29 16:2xZ, Main webhook session `sess-1793290705983-7vrm4h`):** live read open, 0 comments, no
labels, unassigned, never edited; no PR names #14030 (author has many open PRs 10-25..10-29, none for this).
Post-R6-merge rule (nanoclaw#1993, no wait unless newcomer labels): unlabelled human issue → triage, as #14015.
Dispatched to `slang-triager`, thread `gh-issue-shader-slang/slang-14030`. Design note given: part 2 is a
maintainer design call; part 1 needs a dedupe/relationship decision against #10214.

**16:38Z [Triage], checked live 16:4xZ:** comment 6502609277 by nv-slang-bot (no @-mentions, no links; slang-rhi
named as plain text), label `reproduced`, Issue Type Bug, unassigned, open. Triager's findings: reproduced on master
9b3ac252d, all six rows match. Not a regression (PR #6871 shipped spec-const array sizes with SPIR-V-only tests).
GLSL/WGSL/Metal: count is a bare `global_param`, `emitVal` (slang-emit-c-like.cpp:834) has no case → E99999.
HLSL/CUDA: `collectGlobalUniformParameters` rewrites it to `globalParams.kTile` → HLSL VLA, CUDA `getIntVal`
(slang-emit-cpp.cpp:1187) E99997. Function-local `float a[kN]` fails too. Approach A (native GLSL constant_id + WGSL
override workgroup array; one IR-level diagnostic elsewhere, before slang-emit.cpp:1363, E55205-style) recommended.
Memo: `/workspace/inbox/a2a-1793292064189-7jf7oz/triage-14030.md`.

**#10214 overlap:** assigned jvepsalainen-nv, no activity since 02-25 (jhelferty-nv's "is this supposed to work?" to
kaizhangNV unanswered); only PR is draft #10215 (rkoivunen-sw, test-only, stale since 02-27). The reporter
cross-posted the groupshared case on #10214 at 16:18:50Z. Fixer PR will say "Related #10214", not "Fixes". Approach A
implicitly answers #10214's question "yes" — a judgment call surfaced to the operator.

**Sessions on the canonical thread 16:40Z:** Main `sess-1793290705983-7vrm4h`, triager `sess-1793290916715-vyno45`,
fixer `sess-1793291839204-sepof9` (one each). Timer t-3605ec is in the triager group (not visible from Main).

**PARKED (ask 2 only):** maintainer picks implicit extern-__shared__/[[threadgroup(N)]] lowering vs explicit opt-in
form vs core-module dynamic-groupshared pointer intrinsic (all need slang-rhi runtime work). Operator told on
orchestrator-dashboard 10-29 16:4xZ.

**19:36Z draft PR #14049** (`fix/issue-14030`, head 9f7c57cc8, nv-slang-bot, "Support spec-constant-sized arrays on
GLSL/WGSL and diagnose them on other targets"; "Part of #14030", "Related #10214"). Issue update comment 6506657387
(19:43:58Z). Triager [Report] 19:46Z: in bot peer review; suite 11306/11309 (3 fp8 CUDA fails also on master).

**🔴 Diagnostic-code collision (found by Main 19:5xZ, checked on both diffs):** #14049 adds
`specialization-constant-sized-array-not-supported` = **55219** in `slang-diagnostics.lua`; open draft #13939
(#13931 chain, opened 10-25) already adds `clip-cull-distance-vector-in-arrayed-varying` = **55219**. Master's
highest in that block is 55218. #13939 was first, so #14049 renumbers. Sent to triager (msg 20 edge) to pass to the fixer.
**My suggestion of 55220 was wrong, and so was my count of 4 CHECK lines** (it was 9; my grep had `head -5`). The triager
scanned all 499 open PRs (19:59Z, I spot-checked them): 55219 = #14049, #13939, #13856 (bot drafts), #13652 (reporter's
draft), #13387 (jvepsalainen-nv, **non-draft**); 55220 = #13939, #13652; 55221 = #13940. The fixer is moving to **55222**, re-scanning
before the push, and updating the CHECK lines, the PR body and comment 6506657387. Fleet lesson: shared learning "Pick a new slang
diagnostic code by scanning open PRs". #13856/#13939 still collide with the human #13387; I offered the operator to
dispatch renumbers.

**20:21Z renumber done, verified live:** #14049 head **93a6fe673**, 12 refs to 55222 and none to 55219 in the diff, comment
6506657387 edited 20:19:04Z (says E55222). Fixer re-scanned 66 open PRs that touch the lua file; 55222 is unclaimed. CI dispatched, peer
review requested from slang-reviewer.

**21:38Z R1 REQUEST_CHANGES (head 93a6fe673; reviewer's findings),** delivered to the fixer (fixer seq 16/18/20), with a CC to
me. Reviewer session `sess-1793305253993-20tz1k`. File: `/workspace/inbox/a2a-1793309897474-4xywzo/combined-review.md`.
🔴 B1: default-initialized spec-const array/struct (`Data d = {};`, `float local[kTile] = {};` + partial store)
segfaults (rc 139) on GLSL: `cast<IRIntLit>` in `MakeArrayFromElement` emit (slang-emit-glsl.cpp ~2985) because
`processMakeArrayFromElement` (slang-ir-simplify-for-emit.cpp:99-101) skips non-literal counts. Master gives E99999 here, so this is a
crash regression. Options: (a) element-store loop (also fixes direct-SPIR-V E99997) or (b) `as<>` + diagnostic. G1: check misses
wrapped/undeclared arrays → silent invalid Metal/WGSL. G2: E55222 has no source loc for `uniform float g[kN]` on HLSL/CUDA
(`collectGlobalUniformParameters` fieldKey lacks sourceLoc). G3: note wording vs nested WGSL. G4: no CI compiles/runs the
WGSL. A remedy patch for G1+G2 was given to the fixer (seq 18). Verified: GLSL/WGSL on L40S (Dawn), SPIR-V byte-identical, revert
drills pass, full suite 11095/11098 (fp8-cuda).

**22:29Z R1 addressed (fixer's report), head f24a514f4 verified live:** B1 → new E55223
`specialization-constant-sized-array-initializer-not-supported`, an IR-level check on a surviving `makeArrayFromElement`
of a spec-const-sized type (slang-ir-spec-const-sized-array.cpp). Arrays that fold away are unaffected, and on direct SPIR-V
E99997 becomes a clean error, so this is not a regression (my read of the diff). The element-loop option (a) is a follow-up. G1/G2:
reviewer patch applied as-is. G3: note reworded. G4: WGSL tests plus a `-wgpu` run (runs in CI only). Suite 11322/11325 (fp8-cuda). R2
(last round) requested from slang-reviewer.

**10-30 00:44Z [Fix Report] (fixer's report), checked live 00:4xZ:** #14049 is a draft at head **d73c1ea6d**, label `pr: non-breaking`,
assigned + review-requested **kaizhangNV**, MERGEABLE, checks 5 SUCCESS / 53 SKIPPED (draft gate). pr-mapping → fixer session
sepof9. Explanation comment 6506612556 (00:38Z). 26 files +909/−3, 13 commits. R2 REQUEST_CHANGES (small: initializer check ran too early,
Tuple element missed, duplicate E55222) fixed with the reviewer's patch. Suite 11326/11329 (fp8-cuda). **Disclosed behaviour change**
(PR Risk line): E55222 runs pre-optimization, so a list-initialized spec-const local that optimization would remove is now rejected on
HLSL/CUDA/Metal/WGSL, where master compiled it. This sits awkwardly with `pr: non-breaking`, so I flagged it to the operator. Other disclosed gaps: `-minimum-slang-optimization`
SPIR-V E55223; enum-typed size E99997 on direct SPIR-V (pre-existing); glslang ParameterBlock binding loss; WGSL hang on a
spec-const-derived `static const` (pre-existing, **not filed**).

**PARKED** on maintainer review + human un-draft + CI; ask 2 on maintainer design (triager t-3605ec 11-05). Main timer
`recheck-14049-maintainer-a085` 11-03 14:00Z. Operator told on orchestrator-dashboard 10-30 00:4xZ.

**Resume on:** maintainer review/comment (webhook); triager [Triage Resolution]; timers; maintainer comment on #14030 (webhook); t-3605ec.
