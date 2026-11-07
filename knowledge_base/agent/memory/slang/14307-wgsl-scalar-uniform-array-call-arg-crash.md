---
type: chain
title: slang#14307 — WGSL crash when a scalar uniform array element is a call argument
description: "Human-filed by jackerley 11-04, who says their own fix PR is ready. Same root cause and same code site as #13380, the untyped scalar VectorReshape swizzle in slang-ir-peephole.cpp, which our draft PR #13381 already fixes (awaiting jkwak-work since 10-07). Triage done 11-04 16:29Z: #13381 and the reporter's ready-for-review PR #14308 both fix it, with byte-identical WGSL. jkwak-work self-assigned and is review-requested on #14308. Which PR lands is the maintainer's call. Parked; no bot action."
---

# slang#14307

**2026-11-04 ~15:53Z, webhook `issue_opened`.** Live read: OPEN, 0 comments, no labels, no
assignee. Human-filed by jackerley (Slang v2026.21-5, Windows, `0xC0000005`). `grep 14307 memory/`
returned nothing. jackerley has no PRs open yet (`gh pr list --author jackerley` is empty), although
the issue says "I have a PR ready" and names the test `tests/wgsl/uniform-scalar-array-element-as-call-arg.slang`.

**Duplicate root cause.** The reporter blames the scalar-result path of the `kIROp_VectorReshape`
fold in `slang-ir-peephole.cpp`, which builds `emitSwizzle(resultType=null, ...)`. That is the
code [#13380](https://github.com/shader-slang/slang/issues/13380) covers, and our **draft PR #13381**
(`fix/issue-13380`, head `5a1d1474e9`) rewrites that exact hunk to
`emitVectorReshape(inst->getDataType(), …)` and makes `emitSwizzle` assert a type. #13381 is
assigned to and review-requested from jkwak-work, and has been `awaiting_human` since 10-07. The
#13380 thread already logs one other crash symptom (the #13480 POD `bit_cast` segfault, 10-07). The
#14307 call-argument → DCE crash is a third symptom.

**Owners.** The slang-fixer session that owns #13381 is `sess-1790902405168-47vkqg`
(thread `gh-issue-shader-slang/slang-13380`). It got no dispatch: two PRs for one fix is a
maintainer's call, not ours.

## History

- **11-04:** Dispatched slang-triager on `gh-issue-shader-slang/slang-14307` in advisory posture.
  Its job: reproduce on master, confirm the #13381 head fixes it, and post one triage comment that
  links #13380/#13381 without discouraging the reporter's PR. No fixer handoff.
- **11-04 16:30Z triage report (receipts checked):** [comment 6636022078](https://github.com/shader-slang/slang/issues/14307#issuecomment-6636022078)
  is bot-authored, 2404 chars. Labels are `WebGPU` + `reproduced`; jkwak-work self-assigned. Reproduced on
  master `3da6f63c0` (rc 139) for `float[4]`, `int[4]` and both fragment shapes. #13381 head
  `5a1d1474e9` fixes all 4 (naga, Tint and Dawn accept the output). With only #13381's
  `SLANG_RELEASE_ASSERT(type)`, the crash becomes the assert at `slang-ir.cpp(6117)`, which confirms the same untyped
  swizzle as #13380.
- **11-04 16:06Z:** the reporter opened **PR #14308** (non-draft, `Fixes #14307`, head `ac371c5bd2`,
  review requested from jkwak-work). It is a one-line `emitSwizzle(inst->getDataType(), …)` change plus
  `tests/wgsl/uniform-scalar-array-element-as-call-arg.slang`. The triager measured: WGSL byte-identical
  to #13381; the test passes on both PRs and crashes on master. The comment does not say which PR should land.
- **State: parked on jkwak-work** (#14308 vs our draft #13381). There is no bot action and no timer:
  `pr_closed` or a review on either PR arrives by webhook. If #14308 merges first, #13381 needs a merge-master,
  and its `emitSwizzle` assert plus its compute tests still stand on their own. The triager keeps its worktrees
  `wt-14307-master` and `wt-14307-pr13381` until either PR merges. Memo: `/workspace/inbox/a2a-1793809820078-xlsmfk/triage-14307.md`.

**11-05 00:12Z: #14308 MERGED** (jkwak-work), #14307 closed. No webhook reached any of our sessions (fork PR). The
supervisor (tick 326) found #13381 CONFLICTING/DIRTY and sent its pr-mappings owner `sess-1790902405168-47vkqg` a pinned
merge-master nudge on `gh-issue-shader-slang/slang-13380` (00:25Z, working by 00:26Z): merge master, keep the assert +
compute tests if they still add coverage, report what #13381 still adds. Chain terminal for #14307.

**11-06:** jkwak-work APPROVED #13381 at 17:18:37Z and flipped it ready 17:18:44Z (head `6b04e327`, the 11-05 merge-master; CI 57 pass / 0 fail); review requested from dshreiner-nv. Its `pr_ready_for_review` was NOT forwarded: slang-pr-approver is paused; queued in `data/approver-pause-queue.md`. Merge is the maintainers' call.
