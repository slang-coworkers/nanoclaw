---
type: chain
title: slang#13795 — `-O0 -separate-debug-info` loads slang-glslang and calls its optimizer
description: CLOSED 2026-10-22 — bot PR #13801 (requested by the assignee pdeayton-nv) merged 17:55Z as e485e78611; API behavior kept as-is at the assignee's direction. Terminal, apart from an operator call on filing the out-of-scope link+split+optimizer crash.
tags: [slang, spirv, debug-info, downstream-compiler, closed]
---

# slang#13795 — separate debug info at -O0 goes through the spirv-opt wrapper

**10-20 23:33:47Z, `issue_opened`.** Live read at 23:3xZ: open, 0 comments, no labels, live body =
payload. Reporter pdeayton-nv (MEMBER). Timeline `assigned` actor = jhelferty-nv (timeline `actor` is
who did it), assignee pdeayton-nv — so it is maintainer-assigned to its reporter, not a self-assign.

**Claim (reporter's):** adding `-separate-debug-info` to `-target spirv -O0 -g2` calls
`glslang_compile_1_3` once (opt level None, no passes); `-spirv-opt-path nonexistent.dll` then gives
E00100 + E99996 and an access violation `0xC0000005`. The control without the flag succeeds.

**Likely related:** [#12383](../imported/project_12383_spirv_validation_before_spvopt_strip.md) — the
`-separate-debug-info` strip (`stripDbgSpirvFromArtifact` in `createArtifactFromIR`, slang-emit.cpp)
is independent of `-O` level. My hint only; not verified at current master.

**Routing:** dispatched to `slang-triager` on `gh-issue-shader-slang/slang-13795` (triage + repro +
public triage comment). No fixer: the assignee owns the fix, as in #13336/#13337.

**23:36Z:** triager acked (msg 8). It is rebuilding slangc at master `a760da2f` and researching both questions, triage + repro only.

## Triage, 23:45Z (the triager's finding; I checked the source legs myself)

Reproduced on Linux at master `a760da2fb`. One coupling in `createArtifactFromIR` (`source/slang/slang-emit.cpp`) causes both halves:
- **(1) The no-op call.** `needsDownstreamCompiler` includes `needsSeparateDebugInfo` (:3581-3583), so the SpirvOpt
  compiler is loaded. `compile()` (:3688) is not gated on `needsOptimization`, and the debug strip plus the `dbgArtifact` assignment
  (:3693-3700) live only inside `if (SLANG_SUCCEEDED(compile()))`. The triager's shim logged one `glslang_compile_1_3`
  with OPTIMIZE_SPIRV, optLevel 0, flags 0.
- **(2) The crash.** A failed load leaves `compiler` null, so `if (compiler)` (:3593) skips the block. The function returns SLANG_OK
  with `dbgArtifact` null, and the caller derefs it at `addAssociated` / `getName()` (:3746/:3751). The result is a segfault in Release (exit 139), or the assert
  at `slang-artifact-impl.cpp:244` in Debug. This also happens at -O1 with the split.
- **Recommended:** A+B in one PR. (A) Decouple: drop the split from the load gate, gate `compile()` on `needsOptimization`, and strip the final
  artifact after the block. (B) Return SLANG_FAIL when the compiler is null or `compile()` fails. Rejected: a null guard at :3744 (it masks the problem).
  The coupling dates from #7178 and #11797 kept it on purpose. #12383 is a separate defect in the same block.

**Verified (mine, 23:4xZ):** master is `a760da2fb0`. I checked the gate, `if (compiler)` :3593, `compile` :3688, strip :3693-3700, and the deref
:3746/:3751 against `git show origin/master`. Bot triage comment [6304347467](https://github.com/shader-slang/slang/issues/13795#issuecomment-6304347467)
was posted 23:45:26Z (4391 chars). Labels are `reproduced`, Type is Bug, and the assignee is pdeayton-nv. Memo: `/workspace/inbox/a2a-1792539968393-hvtzrc/triage-13795.md`.
No fixer was dispatched.

## 10-21 00:06Z: the assignee asks for a bot PR

[issuecomment-6304621222](https://github.com/shader-slang/slang/issues/13795#issuecomment-6304621222) (pdeayton-nv, MEMBER,
not edited: live body = payload): *"@nv-slang-bot , please prepare a PR, using your judgment on the fix direction."*
This releases the triage-only hold. I routed it to `slang-triager` (session `m93m8d`, canonical thread), because the
triager owns the fixer handoff ([no-skip rule](../imported/feedback_triage_memo_is_not_my_cue_to_dispatch_the_fixer.md)).
At routing time no slang-fixer session existed for 13795.

**00:08Z, fixer handoff (verified):** the triager handed off at msg 13 with an A+B brief. The handoff comment is
[6304649845](https://github.com/shader-slang/slang/issues/13795#issuecomment-6304649845) (nv-slang-bot, 00:08:02Z). There is exactly one fixer
session, `sess-1792541257795-foxi1s` (slang-fixer, triager edge `epsn3s`, created 00:07Z), so no duplicate. Next: a draft PR, then the triager's
[Triage Resolution].


## 10-21 ~03:47Z: draft PR #13801 (verified 04:0xZ)

[PR #13801](https://github.com/shader-slang/slang/pull/13801) "Split separate SPIR-V debug info without the downstream optimizer".
Draft, head `fix/issue-13795` @`69025b677e`, +572/-66, `pr: non-breaking`, `Fixes #13795`. It touches `slang-emit.cpp`, the test
`tests/spirv/separate-debug-without-spirv-opt.slang` and `unit-test-separate-debug-without-spirv-opt.cpp`. The pr-mapping is to the fixer
`foxi1s` (03:47:04Z). Only 4 checks have run and passed, 56 were skipped (draft), so the real CI has not run. Issue status comment
6307703577 posted 04:00:26Z.

- **A was done as recommended.** The split no longer needs the optimizer, the strip runs on the final module, and `compile()`
  runs only when optimizing. It adds `SLANG_RELEASE_ASSERT(dbgArtifact)`.
- **B was narrowed (fixer's call; the triager agrees).** The CLI fails with E00100. The API keeps returning unoptimized output
  plus E00100. The stated reason is that slang-wasm has no slang-glslang and compiles at the API default -O1. That is fixer-reported and
  not checked: the `SLANG_ENABLE_SLANG_GLSLANG` default is ON, and I could not confirm the wasm side in a quick look.
- **Residual (fixer-reported).** At -O0 with the split, slang-glslang is still opened once, by the `Linkage::buildHash`
  SpirvDis probe (null sink, no optimizer call).
- **Open policy question, in the PR body (blocks merge):** "Should a required but missing optimizer fail API compiles?"
  It is the assignee's to answer. It goes in the parked register (`supervisor-state.json` disposition). No timer, because a
  review or comment arrives by webhook.


## 10-21 04:25Z: the assignee un-drafted the PR. 06:31Z: R1 APPROVE_WITH_NITS (verified)

- **GitHub (my read, 06:3xZ):** pdeayton-nv set `ready_for_review` at 04:25:47Z and requested his own review. No reviews or
  inline comments yet, and no new maintainer comment on #13795. Head is still `69025b677e`. CI: 60 pass, 1 pending, 45 skipped.
- **R1** (slang-reviewer session `fayz2c`, dispatched 04:08Z on the canonical thread; file
  `/workspace/inbox/a2a-1792564264090-32b96z/combined-review-13801-r1.md`): APPROVE_WITH_NITS, 0 bugs. The repro segfaults on master
  and not on head, and output bytes are identical at O0/O1/O3 and -g0..-g3 plus a real precompiled link. Nits: test the
  spirv-opt error that the split used to hide (on master, `-Xspirv-opt --bogus-pass -separate-debug-info` exits 0 with no output); assert the API
  outcome (OK + E00100) directly; fix the over-claiming and stale comments (`slang-emit.cpp:3522` "skip loading entirely",
  `gh-11662.slang`, the test header, the `stripDbgSpirvFromArtifact` doc); weaken the fake-linker identity claim. Disagreements with the fixer: 5 of 6, not 6 of 6, new tests
  fail on reverted emit in Release (-O1 `.slang` passes, since both are -1); the suite count was 10981/10999, all pre-existing or environment.
  The fixer is applying the nits with no new round, then sends a Fix Report.
- **Pre-existing, out of scope (reviewer's finding, not reproduced by me):** linking a precompiled `-embed-downstream-ir` module
  with `-g2 -separate-debug-info` and the optimizer running (`-O1`, or `-O0 -Xspirv-opt …`) segfaults inside libslang-glslang, and master does the same.
  At -g0/-g1 without the split, the same link fails with spirv-opt "OpExtInst set Id N does not reference an OpExtInstImport". The reviewer suspects a dangling
  ext-inst set id (not traced). The repro is in the reviewer's `review-13801/link/`. **Not filed**; it is an operator call.

**06:53Z, R1 nits pushed (verified):** head is now `2f08561b31`. Three commits on top of `69025b677e`: `06a5f9a380` tightens the tests,
`e153a98b33` documents the createArtifactFromIR contracts, and `2f08561b31` changes the wording to "not required, not never loaded". There are still no GitHub reviews. The triager is
waiting on the fixer's Fix Report and will then send the Triage Resolution.


## 10-21 06:55Z: Triage Resolution (all tiers reported)

The triager closed its tier as fixed. Fixer-reported tests: 7/7 new tests pass, and 0/7 pass on master's emit (Debug drill). Regression suite 2361/2361.
GPU vk+cuda 10987/10990, where the 3 fp8-cuda failures are environmental and also fail on master. Output is byte-identical with slang-glslang present.
**CI (my read, 07:0xZ):** the PR's `pull_request` CI run `39557486797` is running the full matrix (11 done, 14 in progress), and the
`falcor-build-approval-gate` is waiting on a human. The `workflow_dispatch` run `39557479625` yielded to human priority
(`wait-for-human-priority` + `check-ci` failure, 44 skipped), as expected for a bot dispatch.
The triager credited the crash finding to "the fixer"; R1 says slang-reviewer found it. The repro is in the reviewer's
workspace, not mine (`/workspace/agent/review-13801/link/` does not exist here). It is in the `_operatorSteerPending` register as `13795_link_split_opt_crash`.


## 10-21 16:53Z: assignee APPROVED (verified)

[Review 5603198637](https://github.com/shader-slang/slang/pull/13801#pullrequestreview-5603198637): pdeayton-nv, APPROVED, empty
body, on `2f08561b31`, no inline threads. `mergeable_state: blocked`, because a review is still requested from **jkwak-work** (CODEOWNERS). CI: 60
pass, 1 pending (Windows Falcor). At 17:00:13Z the fixer asked on the PR ([6321711234](https://github.com/shader-slang/slang/pull/13801#issuecomment-6321711234))
whether the approval accepts the current API behavior (E00100 + unoptimized module). Its plan: if yes, drop the "Open question (blocks merge)"
line, because the squash commit copies it; if no, change the behavior or defer explicitly. The empty-body approval does **not** answer the policy question. The fixer reported to me directly (msg 42).


## 10-21 17:55Z: API policy settled (verified)

pdeayton-nv ([6322830847](https://github.com/shader-slang/slang/pull/13801#issuecomment-6322830847), MEMBER, not edited):
*"@nv-slang-bot , please update the PR body and preserve current behavior."* The fixer removed the "Open question" line and restated the behavior as **Risk**:
"With a required optimizer missing, the API still returns the unoptimized module plus E00100, as without the split." It also updated the explanation comment. Its reply is
[6322975440](https://github.com/shader-slang/slang/pull/13801#issuecomment-6322975440) (18:03Z), with no code change; head is still `2f08561b31`. The PR is `BLOCKED` only on the
**jkwak-work** CODEOWNERS review. CI: 61 pass, 1 pending. The bot side is done.


## 10-22 17:55Z: MERGED, issue closed (verified). Terminal.

pdeayton-nv merged PR #13801 at 17:55:31Z (merge commit `e485e78611`). The only review was pdeayton-nv's APPROVED. The jkwak-work CODEOWNERS request
did not block the merge. #13795 closed as completed at 17:55:32Z. The fixer removed `wt-slang-13795` and the `active-work/slang-13795` sentinel, and
edited status comment 6307703577 in place (17:58Z). **The one open item is not part of this chain:** the operator has not yet decided whether to file the
out-of-scope crash (`_operatorSteerPending.13795_link_split_opt_crash`).
