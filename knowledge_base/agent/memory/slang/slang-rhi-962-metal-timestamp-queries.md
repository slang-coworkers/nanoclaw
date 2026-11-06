---
type: chain
title: slang-rhi#962 — Metal timestamp queries not implemented (writeTimestamp no-op, getResult SLANG_E_NOT_AVAILABLE)
description: Human-filed (albertrodriguezclo) 2026-11-01, cloth-sim porting batch (sibling of slang-rhi#961 / #964 / slang#14136). Triaged 11-01 feature/medium/P2. Reporter PR #963 (draft) implements it; maintainer skallweitNV found 2 correctness bugs and proposes a Metal 4-only design. HELD maintainer-owned since 11-02 (jkwak-work self-assigned, Q4 2026): no bot post, no fixer, no timer.
resource: https://github.com/shader-slang/slang-rhi/issues/962
tags: [slang-rhi, metal, query-pool, timestamps, maintainer-owned]
---

# slang-rhi#962 — Metal timestamp queries

**Ask (reporter's claims, unverified).** `cmdWriteTimestamp` (`src/metal/metal-command.cpp`) is a no-op
(`sampleCountersInBuffer` on a blit encoder is commented out); `QueryPoolImpl::getResult`/`getResultState`
(`src/metal/metal-query.cpp`) return `SLANG_E_NOT_AVAILABLE`. The pool makes an `MTLCounterSampleBuffer` and
`cmdResolveQuery` resolves it, but nothing is sampled. Repro via SlangPy 0.43 on M4, rhi main 30250fa1.
Proposed: stage-boundary sampling via pass-descriptor `sampleBufferAttachments` (Dawn's approach), or
`GPUStartTime`/`GPUEndTime`; otherwise report "unsupported" through a feature flag, not an error at read-back.

**Routing (11-01 ~20:15Z).** Live: open, 0 comments, no labels/type/assignees. The only session on
`gh-issue-shader-slang/slang-rhi-962` was my own webhook session. **R6:** no `bot-ok`; the fence shows a Python
`RuntimeError` from an error return, not a crash word → hold to **2026-11-05 20:07:45Z** (comments, PRs, commits
naming #962). Dispatched to slang-triager on that thread (msg 7): verify the claims, check whether Metal advertises
timestamp support it cannot give (that part would be a bug), options A–D, dedupe, hold the draft, one-shot after
the hold. No Metal device here, so source-only. No fixer chain or slangpy filing without my go-ahead (operator for a fixer).

**11-01 20:12Z** the triager acked (session `sess-1793563919824-3ixjox`); nothing posted.

**Triage (slang-triager [Report] 11-01 20:30Z, rhi main 30250fa, source-only, no Metal device). These are the triager's
findings. I verified: Type=Feature, 0 comments, no labels; the t-bf3f6d task session exists; Metal adds no
`Feature::TimestampQuery` (`metal-device.cpp:244-269`); and `docs/api.md:241` marks `writeTimestamp` "yes" for Metal and WGPU.**
- All 3 claims are true: `metal-command.cpp:1069-1078` (the call is `SLANG_UNUSED` and the blit sample is commented out), and
  `metal-query.cpp:67-75`. The pool is resolved (`metal-command.cpp:427-439`) but never sampled.
- **Not a false advertisement:** Metal never reports `TimestampQuery`, and its frequency is 0. The reporter's fallback already works
  through `has_feature(timestamp_query)`.
- **Small defects:** the failure comes late (`createQueryPool` succeeds, and the debug layer says nothing). The docs are wrong for
  both Metal and WGPU.
- **Tests:** `tests/test-cmd-query.cpp` SKIPs without the feature. On the L40S, 57 of 57 passed (16 VK + 13 CUDA timestamp
  tests). WGPU skips, so the rhi WGPU backend has the same gap.
- **History:** #307 (westlicht, 2025-04) turned the writes off. #763 removed the old `getResult`. #502 and #761 already
  say Metal lacks timestamps. There is no duplicate.
- **Options:**
  - **A (rec.):** stage-boundary `sampleBufferAttachments`, plus Dawn's empty-blit trick for a write between passes,
    a CPU `resolveCounterRange` after completion, and gating on `supportsCounterSampling`.
  - **B:** `sampleCountersInBuffer` on AMD Macs only, as a second path inside A.
  - **C:** `GPUStart/EndTime`, which needs a new API.
  - **D:** fail early, plus the docs fix. Small; can ship first.
  - **Ticks:** raw ticks plus a frequency from `sampleTimestamps:gpuTimestamp:`, and `getTimestampCalibration`.
  - **Risk:** wgpu issue 9414 reports zero timestamps on macOS 26 when the GPU resolve runs before sampling ends.
    A CPU resolve after completion avoids this.
- Memo: `/workspace/inbox/a2a-1793565025293-cshp13/triage-slang-rhi-962.md`. Held draft: the triager's
  `memory/issues/comment-slang-rhi-962.md`.

**Next.** At t-bf3f6d (11-05 20:10Z), the triager posts the draft, or replies to a human comment, or skips if a PR exists.
A slang-rhi maintainer (likely westlicht or skallweitNV) picks A/B/C/D. No fixer chain without the operator; D is the
natural first fixer item once a maintainer agrees.

**11-01 22:10Z (from the #964 triage, verified).** The reporter opened **PR #963** "Metal: implement timestamp queries"
(ready, 20:39Z, branch `fix/metal-timestamp-queries`, closes #962; touches `metal-command.cpp/.h`, `metal-device.*`,
`metal-query.cpp`, `docs/api.md`, `tests/test-cmd-query.cpp`). It ends the encoder at `writeTimestamp`. At t-bf3f6d, the
one-shot's "a PR exists" branch applies, so the held options A–D are mostly moot. It conflicts with #964's option A, so
#964 should land after it. No reviewer is dispatched (both approvers are paused, and no webhook routed it here).

**11-05 20:15Z (triager [Report] from one-shot t-bf3f6d, msg 2; I verified the live state and the review text).**
The held brief was NOT posted, because PR #963 supersedes it. Live: #962 is open with 0 comments and no labels.
**jkwak-work self-assigned it on 11-02 at 18:03:36Z** (after kaizhangNV, the auto-assigned PR shepherd, was unassigned) and milestoned it
Q4 2026 (Fall), so rung 4 applies (maintainer-owned). **PR #963 is a DRAFT** (not ready, as the #964 record says), head `9488202`,
last activity 11-03 19:36Z. skallweitNV's review (comment 6572700741, 11-02, read verbatim) raised three points:
(1) native command buffers allocated during recording deadlock `finish()` after 64 write/resolve cycles (queue capacity 64);
(2) a dropped render-pass write still becomes `Resolved` with stale data;
(3) A→X→B→Y→C does not measure B.
skallweitNV proposes timestamps **only via Metal 4** (MTL4 writeTimestamp + counter heaps). On the old path, TimestampQuery stays off
and pool creation is rejected (= our option D). The reporter agreed (comment 6611688615) and prototyped Metal 4 on an M4 (6613620396).
They offered two PRs: the Metal 4 command path first, then timestamps.
- **Decision (msg 15, 20:20Z, landed in the triager's `sess-1793564983977-2w2063`):** no fixer handoff, the D-gate included,
  because the reporter's work owns it. I asked the triager to cancel its new one-shot t-497cc3 (set for 11-12), as for #961 and #964.
  The memo and draft are kept. The chain resumes only on an @nv-slang-bot mention, a human comment addressed to the bot,
  or an operator go-ahead.
- The triager's memo gap: options A–D missed the Metal 4 counter-heap route. The acceptance criteria also lacked
  "unsupported writes never become Resolved" and "no unbounded native command-buffer allocation".
- 11-05 20:21Z the triager confirmed (msg 18): t-497cc3 is `cancelled`, and its slang-rhi-962.md records the maintainer-owned hold with no R6 mention.
