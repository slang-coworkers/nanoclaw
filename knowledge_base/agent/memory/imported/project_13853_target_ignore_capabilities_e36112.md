---
type: project
name: project_13853_target_ignore_capabilities_e36112
description: "10-29 20:58Z: #13855 APPROVED by jkwak-work + ADDED TO MERGE QUEUE (head e4d6a4a1f7); approver webhook not forwarded (slang-pr-approver paused), queued in data/approver-pause-queue.md. 10-28 09:00Z re-check: #13855 OPEN, APPROVED by skiminki-nv 10-26, mergeStateStatus BLOCKED, head e4d6a4a1f7. TRIAGED 10-22 16:22Z (reproduced; API-only, command line unaffected; comment 6345694984; parked on #13855 review + CI approval). DISPATCHED to slang-triager 10-22 16:1xZ on maintainer ask (skiminki-nv comment 6345456165: reproduce + check command-line disabling of 36112). Held 02:50Z as human-owned. slang#13853 (albertrodriguezclo, external): IgnoreCapabilities in TargetDesc::compilerOptionEntries does not silence E36112, because resolveStageOfProfileWithEntryPoint passes the session optionSet to maybeDiagnose inside its per-target loop (confirmed on master ffbd1771e5, slang-check-shader.cpp ~2726-2739). Sibling of #13847/#13848. Author's fix PR #13855 (fix/target-profile-check-option-set, +1/-1 plus a unit test, reviewer dshreiner-nv)."
---

# slang#13853: target-level `IgnoreCapabilities` does not silence E36112

**10-22 02:45:29Z `issue_opened`.** Main webhook session `sess-1792637131246-dpm0l4` (thread
`gh-issue-shader-slang/slang-13853`). Live read: open, 0 comments, no labels, assigned to skiminki-nv by
github-actions.

**Claim checked on master `ffbd1771e5`.** `resolveStageOfProfileWithEntryPoint` loops over `targets` and reads
each `target->getOptionSet().getProfile()`, but calls `maybeDiagnose(sink, optionSet, ...)` with the
session-level `optionSet` parameter for `EntryPointAndProfileAreIncompatible` (E36112). The report is accurate.

**Ownership.** The author opened **PR #13855** 28 s after the issue ("Fixes #13853"). It is not a draft, and
dshreiner-nv is the requested reviewer. It changes one line in `slang-check-shader.cpp` and adds
`tools/slang-unit-test/unit-test-target-profile-stage-ignore-capabilities.cpp`.

**Disposition: held, nothing dispatched or posted.** This is the same pattern as
[project_13847_target_ignore_capabilities_e36107](project_13847_target_ignore_capabilities_e36107.md):
a human filed the issue with their own fix PR. Our #13638 triage comment is about E36107, not E36112, so this PR
alone does not make that comment stale.

**Timer:** the one-shot `13848-merge-recheck-9ccf` (2026-10-28T09:00Z) also checked #13855. It fired 10-28 and is
spent; no second task was created.

**10-22 16:10Z maintainer ask.** skiminki-nv (assignee), comment 6345456165: "@nv-slang-bot Please reproduce
this. Check if this is also applies to disabling warning 36112 from commandline." Dispatched to slang-triager on
thread `gh-issue-shader-slang/slang-13853` with the post-authorized marker; told not to open a competing fix PR
(#13855 is the author's). Owner of the bot side of this chain: slang-triager.

**10-22 16:22Z triager report (verified live).** nv-slang-bot comment 6345694984; label `reproduced` and Type=Bug set.
Reproduced on master `0bd71cd70`. The API path is the bug: `IgnoreCapabilities` set on a target does not silence E36112;
set on the session it does. The command line is unaffected: `-Wno-36112`, `-warnings-disable 36112`,
`-Wno-entry-point-and-profile-are-incompatible` and `-ignore-capabilities` all silence it, and slangc has no per-target
form of these options. Side finding, posted on the issue but not filed: `DisableWarning(s)` in `TargetDesc` does not
silence E36112 either, because the `loadModule*` sink uses only the session option set (`slang-session.cpp:208/255`);
#13855 does not change that. #13855 head `f0985d2e`: 4 github-actions check suites are `action_required` (they need a
maintainer to approve the run), 3 succeeded. No fixer handoff.

**Resume on: a maintainer asking for more on #13853/#13855.

**10-28 09:00Z re-check (task `13848-merge-recheck-9ccf`): #13855 still OPEN, approved, not merged.** Head is now
`e4d6a4a1f7`. The author pushed it 10-25 06:28Z (a GCC include fix for the unit test). The author's comment that day
says the CI build failures had the same cause as on #13848. skiminki-nv APPROVED it 10-26 09:26Z, after dismissing an
earlier 10-23 review. `mergeStateStatus=BLOCKED`, most likely on required checks or CI approval. jkwak-work
commented 10-23 20:27Z that they are "waiting on more information", linking #13847. The state is recorded here only:
#13855 does not touch #13638, which is about E36107. Nothing was dispatched or posted.

**10-29 ~21:0xZ `pr_ready_for_review` (synchronize) for #13855: not forwarded.** `slang-pr-approver` is still `paused=1`, so per [pr-approvers-paused](../pr-approvers-paused.md) the PR went into `data/approver-pause-queue.md` instead. The head is still `e4d6a4a1f7`. jkwak-work APPROVED it at 20:58:21Z and added it to the merge queue at 20:58:30Z, so the human review is done and it should merge on its own. If it merges, the queue entry is moot, and #13853 should close through "Fixes #13853". Nothing was posted.

**10-30 repeat synchronize: only the `paused` check was run (still paused, nothing forwarded or messaged).** The merge queue removed #13855 at 00:27Z. jkwak-work merged master into the branch (head `64e47a70be`, 00:57Z) and enabled auto-merge at 01:06Z, so a human is still driving it.
