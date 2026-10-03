---
type: chain
description: slang#13350 — glsl module matrix operator*/*= gated off metal+wgsl (E36107); GO via triager 2026-09-30; follow-up #13355 (62 builtins) filed, unauthorized for fix.
---

# slang#13350 — glsl-module matrix `*` unavailable on WGSL/Metal (E36107)

- **Reporter:** andy-slater (external). ShaderToy GLSL → WGSL pipeline, follows #11877 / PR #12162.
- **Root cause (verified by me on origin/master, 2026-09-30):** `source/slang/glsl.meta.slang` ~226-287.
  The 3 `operator*` and 4 `operator*=` overloads are `[require(cpp_cuda_glsl_hlsl_spirv_llvm, sm_4_0_version)]`,
  so metal and wgsl are excluded. The `==`/`!=` overloads include both, and the bodies forward to `mul`, which supports both.
- **Not a regression** (per the triager): the gate dates from #3912, before WGSL existed (#5006). The reporter saw the same failure in every version they tried.
- **Triage:** comment 5917443980, labels reproduced+WebGPU+Metal. The triager's prototype widens the gate to
  `cpp_cuda_glsl_hlsl_metal_spirv_wgsl_llvm` and passes on 7 targets.
- **Decision 2026-09-30:** GO, routed THROUGH slang-triager (ANCHOR H). Grounds: no assignee, no competing PR,
  no maintainer comment, a tiny non-breaking gate widen. Draft PR `Fixes #13350` plus a GPU-free wgsl+metal FileCheck test.
- **Resumes on:** the fixer's draft PR, or a human comment on the issue.
- **2026-09-30 19:35, fixer finding (I verified it on origin/master):** 69 `cpp_cuda_glsl_hlsl_spirv_llvm` gates. Besides the 7 operators, 62 other
  builtins are gated off metal/wgsl, for example `mix`, `mod`, `inversesqrt` and `atan(y,x)`; `fract` is not gated. The PR stays scoped to the 7.
  I said YES to the triager filing a bot follow-up issue with a per-builtin callee audit, after a dedup check, linked from the #13350 PR body.
- **2026-09-30 19:46Z: follow-up filed as [#13355](https://github.com/shader-slang/slang/issues/13355)** by slang-triager
  (bot-authored, labels reproduced+WebGPU+Metal). Its body covers the 62 builtins, the 4-builtin repro table and the per-builtin
  callee-audit caveats (`packDouble2x32` #10232, the `imulExtended` int64 fallback, `half2float` → `uintBitsToFloat`). The #13350 triage comment links it.
  I did not route it: it is already triaged, and a second triage would repeat its body. Same precedent as #13354.
  **No fix authorized for #13355.** It is much larger than the 7-gate widen and needs an audit per builtin, so it waits on an operator or maintainer go.
  Re-chase task `rechase-13350-13355-d86c` fires 2026-10-02 09:00Z: checks that the #13350 draft PR exists and names #13355, and checks #13355 for human activity.
- **2026-09-30 19:55 (checked live):** draft PR **#13356** (fix/issue-13350 @ 87c6c5c619, +76/−7, 7 gate lines exactly, closes #13350, `pr: non-breaking`).
  Follow-up **#13355** filed by the bot, left UNROUTED, with no assignee; its go/no-go is the operator's call. Re-chase `rechase-13350-13355-d86c` (2026-10-02 09:00)
  was updated to cover #13356 reviews/CI and the #13355 go/no-go.
- **2026-09-30 21:39 [Triage Resolution] (checked live):** #13356 is a draft at 39e7f0415e (+101/−8, 2 files) with no GitHub reviews. slang-reviewer r2 returned
  APPROVE_WITH_NITS. **No build/test CI has run.** Every build/test job is SKIPPED, including `wait-for-human-priority`, and the falcor gate needs a human.
  Follow-ups: (b) YES, file: four tests use `filecheck=A,B`, and `slang-llvm-filecheck.cpp:92` builds `CheckPrefixes = {fileCheckPrefix}`, so only
  prefix A is ever checked. (a) NO new issue: std140/std430 on WGSL is already open as #8557 ("Dev Reviewed"). Comment there only if Metal/std140 adds information.
- **2026-09-30 21:52 (checked live):** (b) was filed as **#13359** ("slang-test: `filecheck=A,B` silently checks only prefix A") and left unrouted with no assignee.
  The triager's correction: slang-test's own option parser splits on commas (`_parseCommandArguments`), so `B` becomes a separate valueless option. The fix
  options are a non-comma multi-prefix syntax, or a loud error on unknown valueless options. The triager also posted a Metal note on #8557 (cmt 5920354066):
  GLSL std140/std430 fail with E36107 on metal as well as wgsl, so a WGSL-only `[require]` widen won't fix Metal. Triager is idle until #13356 merges.
- **2026-10-01 01:05:** jkwak-work commented on #13359 (5922625720), mentioning @nv-slang-bot: "the \"filecheck\" tool is from LLVM. I wonder how LLVM project uses it regarding the problem you discovered." Routed to slang-triager on `gh-issue-shader-slang/slang-13359` with GitHub-post authorization. Step (3) of `rechase-13350-13355-d86c` now checks that the triager replied and routes only comments newer than this one.
- **2026-10-01 01:25 (checked live):** slang-triager answered jkwak-work in comment 5922837368 (4672 chars, bot author). The answer: LLVM FileCheck accepts comma-separated `--check-prefixes`, and by default it fails when a prefix has no check lines (`--allow-unused-prefixes` turns that off). The conflict comes from slang-test's grammar. The triager also reported a new finding from a local drill: a duplicated option key, e.g. `filecheck=CHECK,filecheck=EXTRA`, crashes slang-test with an uncaught `InternalError` (`Dictionary::add` asserts on duplicates). #13359 is now **assigned to jkwak-work**. Still unrouted, no fix authorized. Step (3) of the re-chase routes only comments newer than 5922837368.
- **2026-10-02 09:00 re-chase (checked live):** Nothing has moved since 2026-09-30.
  - **#13356:** draft @ 39e7f04, 0 GitHub reviews, no inline or human comments, shepherd jhelferty-nv. Checks: 5 pass, 56 SKIPPED.
  - **#13355:** no comments, no assignee, no competing PR.
  - **#13359:** nothing newer than 5922837368.
  - **No triager nudge:** the fixer session already holds the [Fix Report] (21:38) and r2 verdict.
  - I routed nothing. I sent the operator a 5-bullet on orchestrator-dashboard (msg 17) asking for **(A)** a decision on the #13356 CI gate and **(B)** a #13355 go/no-go.
  - Re-armed as `rechase-13350-13355-r2-6066` for 2026-10-05 09:00Z.
