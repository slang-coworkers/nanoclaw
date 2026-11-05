---
type: chain
title: slang#14302 — slangc: use a dedicated exit code for internal compiler errors
description: Maintainer (jkwak-work) filed 2026-11-04 06:45Z; assigned to jkwak-work by jhelferty-nv 13 s later; the author's own fix PR #14303 (non-draft, "Fixes #14302") opened 33 s after the issue. NO DISPATCH, NO bot post — maintainer-driving.
tags: [slangc, exit-code, ice, maintainer-owned, held]
---

# slang#14302 — dedicated exit code for ICEs

**11-04 06:45Z, `issue_opened`.** Live read (11-04 06:46Z): OPEN, author **jkwak-work**, 0 labels, 0 comments.
Timeline: `assigned` to jkwak-work by **jhelferty-nv** (06:45:25Z), cross-referenced by PR
[#14303](https://github.com/shader-slang/slang/pull/14303) (06:45:47Z), milestoned by jkwak-work (06:46:23Z).

**Ask.** `slangc` exits `-1` both for a user compile error and for an ICE. Proposal: `0` success, `1` bad command
line / tool failure, `-1` ordinary compile error (unchanged), `-2` ICE / exception / assertion / abort; document
the codes in `slangc -h`. `compile()` returns `SLANG_E_ABORT` for the ICE cases. An `AbortCompilationException`
after a fatal user diagnostic stays `-1`. Touches `EndToEndCompileRequest::compile()`
(`slang-end-to-end-request.cpp`), `_compile()` (`source/slangc/main.cpp`), `TestToolUtil::getReturnCode()`.

**PR #14303** "Return a dedicated exit code for internal compiler errors", head `dedicated-exit-code-for-ice-2`,
author jkwak-work, non-draft, `Fixes #14302`.

**Disposition: held, nothing dispatched or posted.** Same class as [#14286](14286-metal-compiler-windows-path.md):
the maintainer filed the issue, owns it, and has the fix PR up. The bot has no work. Related test-infra series:
[#14292](14292-slang-test-exit-code-all-test-types.md).

**Resume** only on an @nv-slang-bot mention or an operator ask. A `pr_ready_for_review` for #14303 is a separate
webhook (check approver `paused` first — [pr-approvers-paused](../pr-approvers-paused.md)).

**11-04 ~08:23Z, `pr_ready_for_review` (opened) for #14303** at head `d0023f95f3`, CI 58 pass / 0 fail. `slang-pr-approver` is
`paused=1`, so it was NOT forwarded; queued in [`data/approver-pause-queue.md`](../../data/approver-pause-queue.md) with review
checks (fatal-diagnostic abort must stay `-1`; `SLANG_E_ABORT` really unused; slang-test exit-code series consistency).
Operator told once on the dashboard. A later synchronize for #14303 gets only the `paused` check.
