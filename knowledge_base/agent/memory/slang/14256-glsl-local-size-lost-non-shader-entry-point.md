---
type: chain
title: slang#14256 — GLSL `layout(local_size_x)` lost (LocalSize 1) for a non-`[shader]` entry point found after module load
description: Bot-filed 11-03 21:25Z (labels GLSL, reproduced) as the side-find of the #14250 fixer. FIXER DISPATCHED 11-03 21:31Z (slang-fixer sess-1793741467434-vj18mh, canonical thread). Overlaps #13037 / bot draft PR #13038.
tags: [glsl, entry-point, compute, module-api, render-test, bot-filed, side-find]
---

# slang#14256 — LocalSize lost for non-`[shader]` GLSL entry points

**11-03 21:25:20Z, `issue_opened`.** Author `nv-slang-bot[bot]`, labels `GLSL` + `reproduced`, unassigned, 0 comments.

**Bug.** The module-API path (`loadModuleFromSourceString` → `findAndCheckEntryPoint`, which render-test uses) emits
`LocalSize 1 1 1` for a GLSL compute entry point without `[shader]` that uses `layout(local_size_x = N) in;`.
slangc gives the right size, and so does adding `[shader("compute")]`. Filer's hypothesis, from code reading only:
the attribute is made in `validateEntryPoint` from `findAndCheckEntryPoint`, after the IR was already lowered.
Reflection reads the AST, so CUDA is not affected. Ten GLSL VK tests are silently single-threaded.

**Provenance.** This is the [#14250](14250-subgroup-ballot-bitextract-cuda-hlsl.md) fixer's side-find (`sess-1793734137589-ke79a8`).
I told it to file the issue and leave the routing to me (its seq 10).

**Disposition (Orchestrator, 11-03 21:31Z).** I judged it medium (a silent miscompile on the API path that also hides test coverage),
so the fixer goes on it even though 5 fixer sessions are already running. slang-fixer is on `gh-issue-shader-slang/slang-14256`
(session `sess-1793741467434-vj18mh`, verified on-thread). Constraints I gave it:
- Do not touch #13038, do not claim #13037 (human-assigned), and write "Related: #13037" if the fix overlaps.
- Do not edit `tests/glsl-intrinsic/shader-subgroup/` (the #14249 assignee's area).
- The GPU test must prove that all N threads ran.

Reported to the dashboard (fan-out rule).

**Resume on:** the fixer's `[Report]` (PR number; whether the fix subsumes #13037); a review or comment on its PR; a human comment on #14256.

**11-03 ~23:07Z — DRAFT PR #14275** (`fix/issue-14256`, head `a3a6a9f46`, `pr: non-breaking`). "Fixes #14256"; also keeps
`early_fragment_tests`. Touches `slang-check-shader.cpp`, `slang-ir-link.cpp`, plus a GPU test and a unit test. Body says "Related: #13037
(not covered, no conflict with #13038)". The fixer sent its explain-diff HTML (`/workspace/inbox/a2a-1793747278888-t1cgxt/`).
**Ready-flip pending** (weekly list). Waiting for the fixer's [Report].

**11-03 23:19Z fixer `[Report]`.** The filer's cause is confirmed by tracing, and the actual drop point is the linker. The layout IR does carry
NumThreads, but the extra-decoration allowlist (`slang-ir-link.cpp:551`) dropped it. The fix adds NumThreads + EarlyDepthStencil to that list
(`early_fragment_tests` was lost on the same path).
- Tests: 4 new tests that fail on master and pass with the fix. Full suite 11437/11440; the 3 fp8 coop-matrix CUDA failures also fail on master.
  The 10 weak GLSL VK tests now run N threads and still pass.
- PR body uses the hook-enforced short shape; the five-part write-up is in explanation comment 6617785609 (same as the #14071 precedent; accepted).
- #13037 is NOT covered (the generic lift reads the raw `parentDecl`), and #13038 is untouched.
- CI run 41735217516; slang-reviewer review requested.
- **Side-find:** `layout(local_size_x_id=5, local_size_y_id=6, local_size_z=2) in;` with no `[vk::constant_id]` hits an ICE (E99997, assert
  `slang-check-modifier.cpp:2317`). My dedup found only closed #5948, which is a different bug. I told the fixer to confirm it on master, file it,
  report the number, and not fix it in #14275.

**Resume on:** slang-reviewer verdict / `[Fix Report]`; the side-find issue number; a review or comment on #14275; a human comment on #14256.

**11-03 23:27Z** — the side-find was filed as [#14277](14277-glsl-local-size-id-undeclared-constant-id-ice.md) (reproduced on master `e73d26897`). I gave it its own fixer
chain at 23:28Z. #14275 is still waiting on slang-reviewer (R1 acked 23:19Z, ETA ~90 min).

**11-04 00:59Z** — #14275 round 1 pushed (head `562155b`), which adds the `derivative_group` lift for late entry points (a review follow-up). The fixer sent the R1
explain-diff HTML (`/workspace/inbox/a2a-1793753973007-eew7mj/`). Waiting for its [Fix Report].
**11-04 01:00Z fixer `[Report]`.** R1 was REQUEST_CHANGES; B1 and N1–N6 were applied in 2 commits (no force-push, head `562155bf5`).
- B1: `derivative_group_*NV` was lost on the late path, so the mode was silently inferred wrong once the size was present. The fix is a lift that runs only for
  entry points validated after lowering, plus 2 more linker allowlist ops.
- Tests: 89/89 derivative-group, 3556/3556 broad subset.
- R2 (the final round) was requested from slang-reviewer; CI run 41749771273.

**Resume on:** R2 verdict / `[Fix Report]`.
**11-04 02:01Z** — #14275 R2 applied, final head `d86aeae`; the R2 explain-diff HTML is at `/workspace/inbox/a2a-1793757688266-04wxsm/`. Waiting for the `[Fix Report]`.
**11-04 02:01Z fixer `[Fix Report]`. Chain terminal, held for a maintainer.** #14275 draft at head `d86aeae2b` (+453/−0, 4 files, 7 commits).
- The linker allowlist takes NumThreads, EarlyDepthStencil and the 2 derivative-group decorations, and a `derivative_group_*NV` lift runs for late-validated entry points.
- Review: R1 REQUEST_CHANGES (B1) → fixed; R2 APPROVE_WITH_NITS → nits applied.
- Tests: 1 VK test + 6 unit tests; revert drills show they fail on master. Full suite 11437/11440 (same 3 fp8 CUDA failures as master).
- Known limit, noted in the PR's Risk line: lifted attributes stay on the shared AST, so a function reused as both a compute and a fragment entry point carries `LocalSize`.
- CI run 41757636510. **Ready-flip pending** (weekly list).

**Resume on:** a maintainer review or comment on #14275 (the webhook routes it to the fixer); CI red on #14275; a human comment on #14256.
