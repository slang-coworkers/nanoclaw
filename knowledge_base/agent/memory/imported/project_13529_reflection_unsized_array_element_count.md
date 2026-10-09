---
type: project
name: project_13529_reflection_unsized_array_element_count
description: "[RESTING on maintainers since 10-09 02:01Z; re-chase 10-12] slang#13529 (JackOfBlades232, external, 10-08): reflection getElementCount returns 0 for T[] (and 2147483647 with the reflection arg) instead of documented SLANG_UNBOUNDED_SIZE. Triaged 19:48Z (cmt 6067791498, bug/medium/P2). Orchestrator GO 10-08; draft PR #13535 opened 21:07Z, relabelled breaking 10-09, slangpy run red 5 reflection cases (Approach A ; check isUnsized first); downstream rollout (slang-rhi metal hang, slangpy narrow_cast/uint32 loops) goes into the PR as a maintainer question. T[0] runtime-index SPIR-V Poison ICE side finding FILED as #13531 (10-08 20:08Z, verified live); owned by this chain, no fixer."
metadata:
  node_type: memory
  type: project
---

# slang#13529: reflection reports elementCount 0 for unsized arrays

**Issue.** `var a: Texture2D<float4>[]` and `[0]` give the same reflection: `getElementCount()` returns 0 for both, and the JSON
shows `elementCount: 0`. `slang.h` and `09-reflection.md` document `SLANG_UNBOUNDED_SIZE`. Unassigned, no milestone. A sibling
by the same reporter, #13530 (uniform `float4[]` → invalid SPIR-V OpLoad), has its own Main session `sess-1791486246245-21zbvm`.

**Root cause (triager; Main confirmed in source at origin/master f6238cee3b).** `slang-reflection-api.cpp` ~:653
`return isUnsized ? 0 : …`. The `tryFoldIntVal` branch just above it runs first, so passing the reflection arg returns the magic length
2147483647. Not a regression. Workaround posted: `getBindingRangeBindingCount` and
`getDescriptorSetDescriptorRangeDescriptorCount` already return UNBOUNDED.

**Decision 10-08 ~20:0xZ: GO for a draft PR on Approach A** (check isUnsized first → SLANG_UNBOUNDED_SIZE, plus a T[0]-vs-T[]
unit test covering the reflection-arg case, plus regenerated goldens). Same basis as the #13461/#13480 precedent: unassigned
issue with no maintainer owner, and drafts only. The fix restores the documented contract, so B (a new API) and C (document 0)
stay rejected. Downstream consumers would hang or throw on the sentinel: slang-rhi metal-shader-object-layout.cpp:22, and
slangpy shader_cursor.cpp:336, cursor_utils.h:243/:1018, refl/type.cpp:601. The PR body lists these as an open rollout
question; the fixer does not patch those repos. Label: relabelled `pr: breaking change` on 10-09 (see below); maintainers may override.

**Side finding: filing ordered.** A runtime index into a global `Texture2D<float4>[0]` gives E99997 "Unhandled global inst in
spirv-emit: Poison". Main re-reproduced it on the Release build at f6238cee3b. Triager's range: 2026.7 OK, 2026.12+ broken. Dedup:
#10069 (zero-size array in a nested struct, a different "non-simple operand" ICE) is related, not a dup. No issue mentions
Poison. slang-triager files it from the -13529 session, cross-linking #13529 and #10069.

**20:08Z side finding filed: [#13531](https://github.com/shader-slang/slang/issues/13531).** Main checked it live: nv-slang-bot, labels reproduced+regression,
4394 chars, no @-mentions, links #10069 and #13529. Range is tested-only: 2026.7 OK; broken on 2026.12/.16/.19 and master. GLSL undeclared `_S3`
fails since 2025.12 (predates). #11491 (IRPoison hoistable, v2026.11) is named as a hypothesis, not bisected. The issue_opened webhook
minted the sibling Main session `sess-1791490016039-ftxrc1`; this record is its owner marker. Disposition follows the #13486 precedent:
nothing dispatched, and only a maintainer can ask for a fix. A bot-addressed human comment routes to slang-triager on `gh-issue-shader-slang/slang-13531`.

20:02Z fixer build started (`fix/issue-13529`, wt-slang-13529).

**21:07Z draft PR [#13535](https://github.com/shader-slang/slang/pull/13535)**, verified live by Main 21:4xZ: draft, head `b6f4526ee8`,
1 commit by nv-slang-bot (no Claude trailer), `pr: non-breaking` (the body asks breaking vs non-breaking), closes #13529, 5 files +138/−15
(reflection-api.cpp, 2 goldens, new reflection test, new unit test). The pr-mapping goes to slang-fixer `sess-1791488997843-kov0b5` on the -13529 thread.
Triage cmt 6067791498 was edited to link #13535 and #13531. 21:46Z triager retraction: the neural-autodiff-constexpr-crash{,-full} "fail on master" claim came from a stale build. Both pass on a clean
f6238cee3 Release and on the branch, so no body note is needed. The fixer's PR comment says the same; Main did not re-run them (no slang-test built in /workspace/agent/slang).
The stale claim never reached GitHub (checked the triage cmt and the PR body).

**10-09 01:01Z reviewer round 1: REQUEST_CHANGES, 0 bugs, 1 gap (G1 = label should be breaking).** Head is now `cd83af94c3` (clarity items
fixed, CI run 37866221431, round 2 in progress). Main checked slangpy main live: `ArrayType` takes `int(element_count())`, so ~size_t(0)
becomes -1 (sgl/refl/type.cpp `safe_reflected_count`). `is_generic()` is `num_elements()==0` (type.h:185/:231) and `any_generic_dims`
tests the same thing. So `func_float_unsized_array` / `func_generic_unsized_array` (test_type_resolution.py:927-959) stop resolving as generic.
**Decision ~01:1xZ:** (1) relabel to `pr: breaking change`. CONTRIBUTING.md:326 calls a change breaking when "an existing application …
may no longer … behave the same way", and slangpy is such an application. Maintainers may override; policy #13498 (swoods-nv) is still open.
(2) GO for a single `workflow_dispatch` of `ci-slangpy-trigger-test.yml` with pr_number=13535. That workflow is the designed manual path, and it runs on its
own once the PR leaves draft. Do not touch `SLANGPY_CHERRY_PICK_PR`, and open no slangpy PR. Expected result is red on the unsized cases, which is evidence.
Q1 (`slang-deprecated.h:479-480`): no edit, triager's reading accepted.

**10-09 02:01Z [Triage Resolution]; chain RESTING on maintainers.** Main checked live at 02:0xZ: draft at `cd83af94c3`, label `pr: breaking change`,
0 GitHub reviews, body links the slangpy run. SlangPy run [37868189439](https://github.com/shader-slang/slangpy/actions/runs/37868189439)
(repository_dispatch) = **failure**: 5 cases of `test_reflection2.py::test_arg_types[float3[]-*]` (vulkan+cuda on Linux and Windows, d3d12 on Windows),
`assert -1 == 0`. ⚠ The triager's prediction for `test_type_resolution.py` was WRONG: those unsized cases PASSED. So the visible break is reflection
`num_elements`, not generic resolution. Round 2 = APPROVE_WITH_NITS (0 bugs; G1 label left to maintainers, reviewers split; nits N1–N3 not applied).
Slang CI 37866221431 `waiting` at the falcor approval gate (draft-held). Issue cmt 6067791498 edited again (still 1 comment).
Re-chase task `rechase-13529-pr13535-*`, fires 2026-10-12 02:00Z.

RESUME: a maintainer comment, review, label change or CI start on #13535/#13529/#13531, or the re-chase firing. → fixer [Fix Report] → triager [Triage Resolution]. A maintainer decision on the label and the rhi/slangpy guard rollout blocks merge.
