---
type: chain
title: slang PR #11387 — autodiff readNone carry gate (fix/issue-11374)
description: nv-slang-bot PR on fix/issue-11374; CHANGES_REQUESTED (jvepsalainen-nv 09-15) addressed, waiting on the maintainer's (A)/(B) lookup decision. 10-23 master merged (head 7d1757f4e2) + one no-ping status comment posted; weekly reply re-chase armed.
tags: [slang, autodiff, readnone, pr, awaiting-maintainer]
---

# slang PR #11387 — autodiff readNone carry gate

- **Owner:** slang-fixer session `sess-1786669705525-8abi44`, thread `gh-issue-shader-slang/slang-11387`. Branch `fix/issue-11374` (author `app/nv-slang-bot`, not draft). Builds on #11377.
- **Review state:** jvepsalainen-nv approved 09-15 12:18Z, then converted to CHANGES_REQUESTED 12:48Z (test-coverage gap: no fixture for the `BackwardDerivativeApply` arm). That gap is fixed (per-arm fixtures). bmillsNV is a requested reviewer.
- **Open maintainer questions** (09-30 19:27Z post, [5918169374](https://github.com/shader-slang/slang/pull/11387#issuecomment-5918169374)): (1) (A) keep #11377's resolved lookup [current design] or (B) call-site lookup + mark the remaining built-in derivatives `[__readNone]` + accept generic carry; (2) whether the #12502 readNone audit lands here or moves with (B).

## Timeline

- 10-08 12:45Z: master merge → head `ec449cee89` (fast-forward, no force).
- 10-05 → 10-16: six weekly re-chases (`rechase-11387-lookup-ab-*`) asked the operator whether to nudge or ask bmillsNV. None was answered, and the default was to hold.
- 10-16: GitHub showed zero checks on `ec449cee89`. The cause was fleet-wide: no open PR whose head predates ~10-09 shows any runs.
- **10-23 12:04Z: operator ask withdrawn as over-gated.** A no-ping nudge is a verified comment, and a plain merge onto our own branch is a code push, so neither is gated ([gating leaf](../imported/feedback_github_writes_operator_authorized.md), 10-21 #13343 lesson). Live state at that time: 94 behind / 18 ahead, MERGEABLE/BEHIND, no human activity since 09-30. Dispatched the fixer pinned (msg 29): plain merge, L40S `no-diff-carry-*` + `tests/autodiff/`, push, then one no-ping comment restating (1)/(2). Fixer row 85 (12:05Z): merge with master `83bf12639e` clean, committed locally as `7d1757f4e2`, build running.
- 10-23 12:25Z: fixer pushed head `7d1757f4e2`. Local L40S runs: `no-diff-carry-*` 16/16, `tests/autodiff/` 1025/1025 (292 ignored). Fixer posted one no-ping status comment restating (1)/(2): [6364833308](https://github.com/shader-slang/slang/pull/11387#issuecomment-6364833308). It also refreshed the explanation comment.
- 10-24 12:00Z verify (`rechase-11387-post-merge-0cda`): head `7d1757f4e2`, MERGEABLE/BLOCKED (CHANGES_REQUESTED still stands). CI: 53 pass, 1 skipped, 0 fail; `falcor-build-approval-gate` WAITING. No human comment, review or inline since 09-30. Dashboard line sent.
- Next: one-shot `rechase-11387-maintainer-a511` on 10-31 12:00Z checks only for a maintainer reply or DIRTY, then re-arms +7d.
