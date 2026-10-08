---
type: project
name: project_13505_slangpy_tests_cross_repo_flake_aggregate
description: "slang#13505 (jkwak-work, self-assigned, CI Stability, 10-07 23:09Z): aggregate of cross-repo SlangPy Tests flakes 09-27→10-07 (17/32 failed job-attempts infra/harness). Proposed fixes are in slangpy: retry the Slang clone/fetch/submodule steps in build-and-test-with-slang, and poll Profiler::tick() in two Windows/Vulkan profiler tests. Triaged 10-08 (cmt 6049508753); NEW verified Windows pwsh false-green (failed fetch masked, default branch tested). HELD on jkwak."
metadata:
  node_type: memory
  type: project
---
**2026-10-07 23:1xZ.** Live read before dispatch: OPEN, 0 comments, human-filed by jkwak-work,
self-assigned, labels `Dev Opened` + `CI Stability`, live body = payload. The only session on
`gh-issue-shader-slang/slang-13505` was this Main webhook session, and no `ncl tasks` matched.
jkwak has no slangpy PR since #1147 (09-10), so no fix PR exists yet.

The issue lives in slang, but both proposed fixes are in **shader-slang/slangpy**:
`.github/actions/build-and-test-with-slang/action.yml` (bare clone/fetch/submodule with no retry)
and `tests/sgl/device/test_profiler.cpp:544/583` (one `tick()` after `device->wait()`; on Vulkan the
query can still be `Pending`, so 0 GPU zones get collected, seen only on Windows `nvrgfx`). The
profiler cause is the author's stated hypothesis and has not been reproduced.

Related slangpy context: #1076 (jkwak, merged 07-28) skipped two *other* profiler tests for the
collector race; #1073 was closed and #1077 (re-enable) is closed; #1155 (open) and bot PR #1158 add
command-recording lifecycle hooks; #1062/#1201/#1202 track the other signatures. The
[[project_12074_sgl_tests_teardown_exitcode_flake]] chain (slangpy#1062) is the teardown member of
this family.

Precedents: maintainer-authored and self-assigned means no fixer dispatch
([[project_11806_cmake_options_maintainer_selffix]], [[project_13499_decl_nesting_validation_to_semantic_check]]).
Dispatched `slang-triager` on the canonical thread: verify the two analysis claims against slangpy
source, check overlap, post the 5-bullet on #13505, and open no PR.

RESUME: triager report, a jkwak reply or "please make a PR" (webhook), or a slangpy PR landing that
references #13505.

**10-08 00:20Z triage report** (memo inbox `a2a-1791418821241-kar3zt/triage-13505.md`). Comment
[6049508753](https://github.com/shader-slang/slang/issues/13505#issuecomment-6049508753) is live
(Main-checked: nv-slang-bot[bot], 5475 chars, issue now has 1 comment, still open, assignee jkwak). Triager: CI flake / medium / P2.
- **Clone: verified.** Main read `action.yml@a2c16f8:74-103`: bare clone/fetch/checkout/submodule, no retry.
  The issue's "~2 h setup" is wrong: setup before the clone takes ~5-40 s. The 37578231030 failure was an instant 403, so a retry may not have helped.
- ⭐ **New: Windows false-green (Main-verified).** On pwsh the step's exit code is the last native command's. Job
  `113010315066` (run 37684966838, #13232) logs `fatal: couldn't find remote ref …gh-readonly-queue…` +
  `pathspec 'FETCH_HEAD'` at 20:59:23Z, yet the job is `success`: it built and tested the **default
  branch, not the PR**. The Linux sibling `113010315010` failed correctly. Triager: 1 of 100 Windows attempts.
  ⇒ a Windows SlangPy Tests green does not prove the PR was tested. Any retry fix has to check `$LASTEXITCODE` per call.
- **Profiler: code claims hold, cause unproven.** `device->wait()` = `vkQueueWaitIdle`, so Pending
  after the wait shouldn't happen (triager's reasoning from the spec). Poll-until-zero could hide a real slang-rhi or driver bug. The
  second hypothesis is the `start_ns >= capture_start_ns` filter (profiler.cpp:881) under calibration skew. Suggested
  first step: log `pending_gpu_zone_count` when the assert fails.
- **Overlap clean:** #1076 skipped different tests, #1124 fixed #1072, and #1158 doesn't touch tick/query.
  The only earlier sighting is a bot comment on slangpy#1080 (08-19), never filed.
- Next step: jkwak files slangpy issue(s), or asks for a bot PR. Nothing is dispatched. Chain HELD on the RESUME triggers above. Re-chase task `rechase-13505-*` fires 2026-10-11T16:00Z.
