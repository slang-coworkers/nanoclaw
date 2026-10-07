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
- **2026-10-05 09:00 re-chase (r2; checked live):** Still nothing has moved since 2026-09-30.
  - **#13356:** draft @ 39e7f04, now 2 ahead / 15 behind master. 0 reviews, 0 inline comments, no human comments. CI run 36780286138 has been `waiting` on the **falcor-ci** environment since 09-30 21:34Z, and our token can't approve it (`current_user_can_approve:false`).
  - **#13355 / #13350 / #13359:** no new activity. #13355 still has no competing PR.
  - No operator reply to msg 17 on the dashboard. I routed nothing and re-asked A/B on orchestrator-dashboard (2nd ask).
  - Re-armed as `rechase-13350-13355-r3-23ff` for 2026-10-08 09:00Z.
- **2026-10-06 22:13 (checked live):** jkwak-work (assignee since 10-01, milestoned) on #13359, comment 6026415243: "I think we should to both: 1. fail loudly when using `filecheck=A,B` 2. support multiple test prefixes but each `filecheck` can take only one keyword, `filecheck=A,filecheck=B`". There's no explicit PR request, so I treated it as a design decision from a self-assigned maintainer, not a go-ahead for us. Routed to slang-triager on `gh-issue-shader-slang/slang-13359`, to acknowledge it, raise the constraints and ask whether jkwak wants a bot draft PR. The constraints I verified on master 98c4f258c6:
  - (a) `commandOptions` is a `Dictionary`, and `.add` asserts on a duplicate key, so a repeated `filecheck=` needs a multi-valued store.
  - (b) `IFileCheck::performTest` takes one `const char*`. Default local builds (`FETCH_BINARY_IF_POSSIBLE`, `cmake/GitHubRelease.cmake`) fetch the prebuilt slang-llvm from the *last release tag*, while CI builds it from source (`USE_SYSTEM_LLVM`). So an interface change works in CI but not in a local build until the next release. The choice is between one performTest per prefix and a versioned interface with a fallback.
  - (c) A 5th affected test landed after filing, from our own bot's #12766 (feb2452bfa, 10-02): `tests/compute/texture-format-through-param.slang:12` `filecheck=CUDA,READ,NEG`.
- The r3 re-chase step (3) routes only comments newer than 6026415243. A jkwak PR request is the go-ahead, and the triager hands it to slang-fixer.
- **2026-10-06 22:48 (checked live):** slang-triager replied in comment 6026863543 (2217 chars, bot author) and asked jkwak-work whether they want a bot draft PR. Before posting, it updated the issue body to add the 5th file (`texture-format-through-param.slang:12`, from #12766) and set the counts to 15 directives / 18 entries / 10 names. The triager corrected my "CI builds slang-llvm from source" read: some legs disable LLVM, and the Windows-debug leg builds slang-llvm and then consumes it via FETCH_BINARY. Its account of the interface-change cost: a new IFileCheck GUID makes an LLVM-enabled slang-test fail at startup against the last-tag prebuilt. That mismatch happens in local builds, not CI. The triager's handoff constraints are in its `memory/issues/triage-13359.md`. Waiting on jkwak-work. A PR request means the triager hands the work to slang-fixer. A "we'll do it" closes the chain. The r3 re-chase routes only comments newer than 6026863543.
