---
type: chain
title: slang#14445 — WGSL/HLSL/GLSL buffer-element field reads fold through an index var that SSA coalescing reuses
description: Human-filed (garyo) 2026-11-10 17:24Z, no labels/assignees. Triaged 17:35Z as a duplicate of the root cause of #13273, already fixed on master and v2026.21 by PR #13283. Test-only PR (B) declined for now; the chain rests on the reporter's confirmation.
tags: [emit, wgsl, hlsl, glsl, wrong-output, already-fixed, duplicate-root-cause]
---

# slang#14445 — buffer field read through a reused index var

**State (2026-11-10 18:32Z): TERMINAL on our side.** The triager posted its delta (cmt 6775810082). Re-check t-c6c62d is cancelled. The issue stays OPEN for a maintainer to close.

Earlier state (18:31Z): reporter confirmed fixed; waiting for a maintainer to close. Reporter (garyo) commented at 18:30:15Z (cmt 6775786952): fixed in 2026.21. There was no @nv-slang-bot mention, so the comment has no post authorization of its own; the triager posts a state delta under its normal workflow and retires the 11-13 re-check. No fixer.

Earlier state (17:40Z): RESTING, no fixer. On v2026.18.3 and v2026.20, `items[index].left` is folded into a later
read after register allocation has coalesced `index` and the two ternary results into one var. The second read then
becomes `items[items[index].left].right`. HLSL and GLSL are wrong too; Metal, CUDA and SPIR-V never were.

**Triager finding (slang-triager, 17:35Z):** same root cause as #13273. It is fixed by PR #13283 (`isSafeToFoldIntoUseSites`,
slang-emit-c-like.cpp). The array member matters only because `isTypePreferrableToDeferLoad` defers a struct >16 B that
contains an array; with `int extra;` the struct is 12 B and is copied. GPU-verified on the L40S: wrong on 18.3 and 20,
correct on 21 and on master 4f66408b3.

**Receipts I checked myself:** PR #13283 merged 2026-10-17 as 60a7c8c88. That commit is an ancestor of v2026.21
(compare `v2026.21...60a7c8c88` = behind 112) and is not in v2026.20 (ahead 1). #13273 closed on 10-17. Triage comment
https://github.com/shader-slang/slang/issues/14445#issuecomment-6774477797 (nv-slang-bot, 17:33:48Z) asks the reporter
to confirm on v2026.21.

**Decision (Orchestrator, 11-10):** option (B), a test-only regression PR for this deferBufferLoad + coalesced-var +
cross-block-GEP path, is **declined for now**. The bug is already fixed, 30 bot PRs are open, and the filing policy holds
low-value fixer chains when shepherds are loaded. Re-open (B) if a maintainer or the reporter asks for a test, or if the
reporter says v2026.21 is still wrong. Triager re-check t-c6c62d is on 11-13 (one-shot).

**Lesson:** `ncl sessions list --agent-group <gid>` does not filter by group (like `ncl tasks --agent-group`). A
"two running fixer sessions on #14445" reading was really my own Main session plus the triager's. Confirm with
`ncl sessions get <sid>` before acting on a duplicate-session reading.
