---
type: chain
title: "slang#14424 — CUDA runtime regression after #13781 ([ForceUnroll(4)] on VECTOR_MAP/MATRIX_MAP)"
description: "CLOSED 2026-11-16, no-op. Held 11-09→11-16 under rung 4; resumed by @nv-slang-bot mention (webhook delivered ~4 days late — comment created 11-12 16:38Z, delivered 11-16 08:45Z). Ask (revert #14425) was already satisfied by jkwak-work's own PR #14463, merged 11-12 19:59:46Z; issue auto-closed. slang-fixer correctly no-opped; no bot PR, no ack (requester authored the revert). #13781 chain: #13765."
tags: [slang, cuda, performance, regression, hlsl-meta, forceunroll, jkwak-work, in-flight]
---

# slang#14424 — CUDA runtime regression after #13781

**Ask.** The nightly perf run shows a CUDA runtime regression after PR #13781 (merge `7036ae6df`). The only part of
#13781 that reaches CUDA is `[ForceUnroll(4)]` on `VECTOR_MAP_{UNARY,BINARY,TRINARY}` and
`MATRIX_MAP_{UNARY,BINARY,TRINARY}` in `hlsl.meta.slang` (the fallback of about 150 overloads). The cause is not found yet. Their synthetic
probe (nvcc -O3, sm_86) shows 23→0 loops, SASS 1656→1672, registers 39→36, no local memory. They did not run a timing test. Plan: (1) a temporary PR
removes the unroll and disables `generic-minmax-vector-codegen-11075.slang` and the `NOLOOP` check of `tests/wgsl/vector-math-no-loop.slang`, with TODOs;
(2) watch the nightly; (3) if the perf recovers, make the fix WGSL-only (`case wgsl:`) and enable the tests again; (4) otherwise revert and bisect.

**2026-11-09 18:3xZ live read.** OPEN, 0 comments, no labels, assignee jkwak-work (the `assigned` event has actor jkwak-work and assigner jhelferty-nv).
No PR references 14424 yet. The only session on `gh-issue-shader-slang/slang-14424` is this Main webhook session `sess-1794248880980-kd1mx2`.

**Why held.** Rung 4 of [feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](../imported/feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md):
the maintainer wrote the plan and owns it (assigned to the author by a peer maintainer, with their own fix direction and their own temp PR).

**2026-11-16 08:45Z — RESUMED by the recorded trigger.** jkwak-work mentioned @nv-slang-bot on the issue
(comment 6829695541): after discussion with the Falcor team they keep ForceUnroll, and asked for a **new PR reverting
#14425** (their temp PR, merged 11-10T00:21:43Z, merge commit `72170828a77c40b00036648b5d30a817334e68a5`). Dispatched
to slang-fixer on the canonical thread — session `sess-1794818896137-mcfp31`, delivery verified. The fixer was told:
revert the FULL contents of #14425 (e.g. `git revert -m 1 72170828a`), no wider/narrower, reference #14424+#14425,
ack the comment. Caveat dispatched: the 11-16 GitHub auth outage (401 on proxied writes; anonymous reads OK via
`curl --noproxy '*'`) — if push/PR/comment 401, park after one attempt each. Outage addendum posted to the operator
dashboard outage thread (seq 512618).

**Link to our work.** #13781 was the reporter's (albertrodriguezclo) fix for [#13765](13765-wgsl-vector-map-unary-loops.md). Our triager
verified it after the merge on 10-23 and reported "no regression". That check was correctness only: slang-test cpu/cuda/vk/llvm 7453/7453, codegen diffs,
and the E38206→E40020 change for matrices with more than 4 rows. **It did not measure runtime.** Lesson: a correctness sweep does not prove a perf claim, so state
that a check was correctness-only when you report "no regression" on a change that alters codegen on all targets.

**2026-11-16 ~08:55Z — CLOSED, no-op (all verified live via anonymous reads).** slang-fixer reported, and I verified
with receipts: the mention comment (6829695541) was **created 11-12T16:38:44Z** but the webhook was delivered
11-16T08:45Z (~4 days late — outage/redrive backlog). jkwak-work reverted #14425 himself ~3h after the comment: PR
**#14463** merged 11-12T19:59:46Z (merge commit `d9a1cc10e`, body "Fixes #14424"), issue auto-closed 19:59:47Z.
Master carries `[ForceUnroll(4)]` on all six macros again (hlsl.meta.slang:8089-8104) and both disabled tests are
re-enabled. Dispatching the fixer cost one cheap no-op turn, not a phantom PR — but a live re-read of the issue
thread at dispatch time (it now has 1 comment + the #14463 reference) would have shown the ask was already
satisfied. See the learning appended to the shared store.

**State after resume (11-16).** Chain CLOSED — no bot PR was opened, no GitHub ack posted (decision relayed to the
fixer 11-16: the requester authored the revert himself on a now-closed issue; an ack would be noise — do not post it
later). Fixer session sess-1794818896137-mcfp31 reported up correctly and is done. Empirical terminal receipt, from
the fixer: `git revert 72170828a` on origin/master (cdca151fb) exits 0 with a fully EMPTY diff — the inverse of
#14425 is already in master.
