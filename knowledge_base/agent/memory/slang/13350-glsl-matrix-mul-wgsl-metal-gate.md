---
type: chain
description: slang#13350 — glsl module matrix operator*/*= gated off metal+wgsl (E36107). TERMINAL 2026-11-04 — PR #13356 merged by jkwak-work (f0660607f1, 20:48:10Z), issue closed COMPLETED. Open, not ours to drive: #13355 (62 builtins) + #13359 (filecheck=A,B) held on jkwak-work; #14257 (std140/Metal) own chain.
---

# slang#13350 — glsl-module matrix `*` unavailable on WGSL/Metal (E36107)

Dated re-chase entries live in [[slang/13350-glsl-matrix-mul-rechase-log.md]]. **New re-chases append there**;
update only the state table below in this file.

## Current state (r7, 2026-10-31 09:00Z, checked live)

| item | state | owner / hold |
|---|---|---|
| #13350 (issue) | assignee jhelferty-nv, milestone Q4 2026 | fixed by #13356 |
| PR **#13356** | OPEN draft, fix/issue-13350 @ 39e7f04 (+101/−8, 2 files), 2 ahead / 178 behind, MERGEABLE. Review requested from jhelferty-nv; 0 reviews, no human comments. Checks 5 pass / 56 skipping. Last comment: our status cmt 6534088003 | **parked for jhelferty-nv**: no push, no rerun, no re-dispatch |
| CI run 36780286138 | `completed/failure` 10-30 21:34:36Z (falcor-ci 30-day env wait expired; no build steps) | not a code fault |
| #13355 (62 gated builtins) | bot-filed, assigned jkwak-work by jhelferty-nv 10-05, Q4 2026, 0 comments, no competing PR | **HOLD** |
| #14257 (dup, Metal only) | jkwak-work self-filed + self-assigned 11-03 21:29Z; same 7 gates. Triager posts a pointer to #13350/#13356 ([record](14257-glsl-matrix-mul-metal-dup-13350.md)) | no fixer; a maintainer ask for #13356 → slang-fixer on this chain's thread |
| #13359 (`filecheck=A,B`) | assigned jkwak-work, last human cmt 6026415243, our reply 6026863543 | **HOLD** |

- Master `glsl.meta.slang` still has 69 `cpp_cuda_glsl_hlsl_spirv_llvm` gates (r7), so #13356 is not superseded.
- Events on #13350/#13356 route to slang-fixer on `gh-issue-shader-slang/slang-13350`.
- **Resumes on:** a review or comment on #13356, a human comment on any of the three issues.
- **Next:** `rechase-13350-13355-r8-6fd2`, 2026-11-07 09:00Z. If all three chains are still held on maintainers, re-arm once ~7 days out (process-after only); if all are closed/merged, do not re-arm.

## Root cause and fix

- **Reporter:** andy-slater (external). ShaderToy GLSL → WGSL pipeline; follows #11877 / PR #12162.
- **Root cause (I verified it on origin/master, 09-30):** `source/slang/glsl.meta.slang` ~226-287. The 3 `operator*` and
  4 `operator*=` overloads are `[require(cpp_cuda_glsl_hlsl_spirv_llvm, sm_4_0_version)]`, which excludes metal and wgsl.
  The `==`/`!=` overloads include both, and the bodies forward to `mul`, which supports both.
- **Not a regression** (per the triager): the gate dates from #3912, before WGSL existed (#5006).
- **Triage:** comment 5917443980, labels reproduced+WebGPU+Metal. The fix widens the 7 gates to
  `cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm` and adds a GPU-free wgsl+metal FileCheck test. slang-reviewer r2: APPROVE_WITH_NITS.

## Decisions

- **09-30 GO**, routed through slang-triager (ANCHOR H): no assignee, no competing PR, no maintainer comment, tiny non-breaking widen.
- **PR scope stays at the 7 operators.** The fixer found 62 other gated builtins (`mix`, `mod`, `inversesqrt`, `atan(y,x)`; `fract` is
  not gated). Those went to bot follow-up #13355, with a per-builtin callee audit (`packDouble2x32` #10232, the `imulExtended` int64
  fallback, `half2float` → `uintBitsToFloat`). I did not route it to a second triage (same precedent as #13354).
- **Decision B (#13355 go/no-go): closed as HOLD** by jhelferty-nv's 10-05 assignment to jkwak-work. A bot fix starts only on a jkwak
  request to @nv-slang-bot, routed via slang-triager on `gh-issue-shader-slang/slang-13355`.
- **Decision A (#13356 CI gate):** asked 4 times (dashboard msg 17, 2nd ask, msg 21, id 13) with options (a) ci-approver approves the run,
  (b) fixer rebases and marks ready, (c) park for jhelferty-nv. **Defaulted to (c) on 10-15. Never ask again.**
- **10-30 gate expiry:** the triager asked for a CI re-dispatch; I did not pass it on (A = (c)). Through the triager, slang-fixer posted one
  status comment (6534088003). A rerun would only ask for `falcor-ci` approval again. Precedents: #13127, #13201, see
  [ci-babysitter-gate-expired-pr.md](ci-babysitter-gate-expired-pr.md).
- **#8557 (std140/std430 on WGSL):** no new issue; the triager posted a Metal note there (cmt 5920354066): GLSL std140/std430 also fail with
  E36107 on metal, so a WGSL-only `[require]` widen will not fix Metal.

## #13359 — `filecheck=A,B` checks only prefix A

- Filed 09-30 by the triager from the r2 review: four tests use `filecheck=A,B`; `slang-llvm-filecheck.cpp:92` builds
  `CheckPrefixes = {fileCheckPrefix}`. slang-test's own option parser (`_parseCommandArguments`) splits on commas, so `B` becomes a
  separate valueless option. A duplicated key (`filecheck=CHECK,filecheck=EXTRA`) crashes slang-test (`Dictionary::add` asserts).
- jkwak-work (assignee) 10-06, cmt 6026415243: do both — fail loudly on `filecheck=A,B`, and support `filecheck=A,filecheck=B`.
  I treated that as a design decision, not a go-ahead for us. The triager replied (6026863543) with the constraints and asked whether jkwak
  wants a bot draft PR; it also added the 5th file `tests/compute/texture-format-through-param.slang:12` (from our #12766) to the issue body.
- Constraints (verified on master 98c4f258c6, with the triager's corrections): `commandOptions` needs a multi-valued store;
  `IFileCheck::performTest` takes one `const char*`, and a new IFileCheck GUID makes an LLVM-enabled slang-test fail at startup against the
  last-tag prebuilt slang-llvm in local builds (`FETCH_BINARY_IF_POSSIBLE`). Handoff detail: the triager's `memory/issues/triage-13359.md`.
- A jkwak PR request means the triager hands it to slang-fixer; a "we'll do it" closes the chain.

## Lessons

- A falcor-gated environment wait fails at GitHub's 30-day limit; predict the date from the run's `created_at` and time the re-chase after it.
- Dashboard reads for re-chases: bounded `--since-seq` pages; jq chokes on control chars, so parse with python `json.loads(strict=False)`.
- **11-04 20:0xZ:** jkwak-work enqueued #13356 at 18:36:46Z. Its SM80Plus job 126789028206 was queued with no runner from 18:51:44Z, so a `checks_timed_out` eviction was likely at about 20:36Z. Main armed one-shot `check-13356-sm80-evictio-905f` (20:45Z): if it is evicted, the fixer posts a no-mention infra comment (same precedent as #14111).
- **11-04 20:47Z:** the one-shot found no eviction. #13356 is still OPEN and still in the merge queue: its only queue event is the 18:36:46Z add, with no removal. Job 126789028206 got runner `linux-sm80plus-9046929f` at 20:40:18Z (in_progress, run 41888920166), which was after the 2 h mark. Nothing was sent and the one-shot was not re-armed. **Lesson:** a job that sits queued past 2 h does not by itself make the merge queue evict the PR, so don't predict `checks_timed_out` from queue age alone.
