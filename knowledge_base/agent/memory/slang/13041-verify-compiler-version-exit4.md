---
type: chain
title: slang#13041 — verify-documented-compiler-version.sh exit 4 on windows-aarch64; bot fix #13042 incomplete
description: The bot's #13042 fix (merged 09-17) did not stop the exit-4 abort. Three post-fix hits, two of them in the merge queue. Routed back to slang-fixer 2026-09-30
tags: [slang, ci, infra, windows-aarch64, bot-regression]
---

# slang#13041: exit 4 from `verify-documented-compiler-version.sh` on `build-windows-debug-cl-aarch64`

Both the issue and the fix PR [#13042](https://github.com/shader-slang/slang/pull/13042) are nv-slang-bot's.
The fix is merge `d89866432c` on 2026-09-17, merged by jvepsalainen-nv. It added `|| true` to the detection
probes, on the theory that `cl.exe` exiting 4 tripped `set -euo pipefail`.

**The fix is incomplete (verified 2026-09-30).** These are exit-4 failures of the "Check documented compiler
versions" step with no stdout, on image `windows-11-vs2026-arm64` and MSVC 14.51.36231. `d89866432c` is an
ancestor of the tested sha in all three:

| Run | Event | Date |
|---|---|---|
| 36450164066 | merge_group | 09-28 |
| 36617546952 | merge_group | 09-29 |
| 36750939170 (#11709, job 110009221626) | pull_request, merge ref `892b0acd` | 09-30 |

There were no other hits in the 20 failed CI runs I scanned between 09-17 and 09-30. The step prints no
output at all, so it aborts before its first `echo`. That points at something other than the pipelines
`|| true` now guards.

**Correcting the babysitter's framing (09-30 18:28Z sweep).** It called this signature "distinct from
#13041", said it had no tracking issue, and proposed filing a new one. Both claims are wrong:
- #12754 and #12749 are named in #13041's own body.
- 4 of its 5 cases predate the 09-17 fix.
The real signal is the three post-fix hits. **Route:** slang-fixer on `gh-issue-shader-slang/slang-13041`,
not a new issue.

## Follow-up (2026-09-30)

- slang-fixer posted the receipts on #13041 as [5918115904](https://github.com/shader-slang/slang/issues/13041#issuecomment-5918115904); the issue stays closed.
- The logs can't pin the root cause. Draft PR [#13352](https://github.com/shader-slang/slang/pull/13352) (head `bc5195c760`)
  adds an ERR trap that turns the silent abort into a `::warning::` naming the command, line and status, then
  exits 0. The PR description carries a falsifiable prediction: if the step still exits 4 in silence, the shell
  or runner is dying, not the script. slang-reviewer gave APPROVE_WITH_NITS with 0 bugs.
- Pending on humans:
  - The operator's ready-flip.
  - jvepsalainen-nv choosing (a) `exit 0` or (b) `exit "$status"` plus `continue-on-error` at
    [5918809172](https://github.com/shader-slang/slang/pull/13352#issuecomment-5918809172).
    The bot can't push the workflow edit that (b) needs.
- Re-chase: `rechase-13352-exit-seman-440c` (2026-10-03 09:00Z).
- The babysitter watches for the `Compiler version check skipped` annotation once #13352 merges (and for a silent exit 4 with the trap in place). It reports hits to **me only**, because it has no slang-fixer destination; I forward them to slang-fixer on `gh-issue-shader-slang/slang-13041`.
