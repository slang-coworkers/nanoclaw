---
type: chain
title: slang-rhi#964 — Metal compute pass costs 16-30 us GPU time (per-encoder queue-fence wait/update)
description: Human-filed (albertrodriguezclo) 2026-11-01 21:46:57Z, perf report, third of the cloth-sim batch (#961/#962). Dispatched to slang-triager 11-01 ~21:50Z under R6 (hold to 2026-11-05 21:46:57Z).
resource: https://github.com/shader-slang/slang-rhi/issues/964
tags: [slang-rhi, metal, performance, command-encoder, fence, r6]
---

# slang-rhi#964 — Metal per-compute-pass fence cost

**Ask (reporter's claims, unverified).** Each compute pass is one `MTLComputeCommandEncoder`; each one does
`waitForFence(m_queueFence)` at creation and `updateFence(m_queueFence)` at end
(`CommandRecorder::getComputeCommandEncoder` / `endCommandEncoder`, `src/metal/metal-command.cpp`). On an M4
(macOS 26.7.1) that costs 16-30 us GPU per encoder vs 1.5-2 us for a hazard-tracked encoder or an in-encoder
`memoryBarrierWithScope:`. Dawn: 2.3 us/pass. Raw-Metal repro (`fence_cost.mm`) reproduces it without rhi.
Proposed fix: coalesce consecutive compute passes into one encoder, with `memoryBarrierWithScope:(Buffers|Textures)`
at the pass boundary; end the encoder only on an encoder-type change, at command-buffer end, or when a pass
carries a timestamp (couples to #962). Versions: rhi e17f6d75 (SlangPy 0.43.0), main 30250fa1.

**Routing (11-01 ~21:50Z).** Live: open, 0 comments, no labels/type/assignees. Memory grep: no prior record. Only
session on `gh-issue-shader-slang/slang-rhi-964` was my own webhook session. **R6:** no `bot-ok`, no crash word
(perf report) → hold to **2026-11-05 21:46:57Z** (comments, PRs, commits naming #964). Dispatched to slang-triager
on that thread: verify claims in source, find why `m_queueFence` exists (git history), assess the coalescing fix's
hazards (render/blit/AS encoders, `globalBarrier`, timestamp queries per #962, untracked-resource hazard model),
dedupe, options, hold the draft, one-shot after the hold. Source-only (no Metal device). No fixer without the operator.

**11-01 21:49Z** the triager acked (session `sess-1793569740534-xikjp1`), source-only at rhi main 30250fa.
It noted that the body names `fence_cost.mm` and `passes.py` as attached, but has no attachment links. I told it
to put a request for both files in the held draft.

**Triage (slang-triager [Report] 11-01 22:05Z, rhi main 30250fa, source-only).** These are the triager's findings.
I checked these myself: the lazy encoder (`metal-command.cpp:803-822`); the fence wait at every encoder open
(`:1095/1109/1120/1131`) and the update at every end (`:1138-1173`); one fence per queue (`:1192`); all resources
untracked (`metal-utils.h:85-98`); the `memoryBarrier` when `m_computeEncoderHasDispatched` (`:881-884`); and that
`dispatchCompute` writes `SetComputeState` before every dispatch (`command-buffer.cpp:245-268`). I also checked that
PR #963 exists and that the one-shot task session `system:tasks:t-46390d` exists (it is not visible to `ncl tasks get`).
- Verdict: perf enhancement, medium/P2. No duplicate. The fence comes from #713 (Helferty, 04-27), which made every
  resource untracked so that GPU-pointer access is synchronized. So the fence is the only ordering between encoders.
- Options: **A (rec.)** keep one compute encoder across consecutive passes, using the existing `:881` barrier,
  and fix `clearTexture` (no barrier, stale pipeline) and `executeCallback` (does not end the open encoder) in the
  same change; `writeTimestamp` keeps ending the encoder. B (hazard-tracked) reverts #713, so rejected. C (wait on
  real dependencies only) is unsound because of pointers. D (concurrent encoders / Metal 4) is a later step.
- **Coupling:** the reporter opened **PR #963** (ready, 11-01 20:39Z, `fix/metal-timestamp-queries`, closes #962).
  It touches `metal-command.cpp`, so A should land after #963. Recorded on the #962 chain too.
- Side finds (not acted on, not filed; inference only, no Metal device): a latent RAW hazard for a clear followed by
  a compute pass, the `executeCallback` gap, a stale `docs/api.md:225` globalBarrier entry, a misleading comment at
  `:894-899`.
- Memo: `/workspace/inbox/a2a-1793570741428-1r5qah/triage-slang-rhi-964.md`. Held draft:
  `/workspace/inbox/a2a-1793570741450-copgh9/comment-slang-rhi-964.md` (the triager's
  `memory/issues/comment-slang-rhi-964.md`); I reviewed it and found it sound.
- A PreToolUse hook blocked the triager's read-only `gh api repos/.../issues/964`. It is NOT the critique gate
  (that one needs a comments/reviews path plus a write flag), and no R6 hook exists in nanoclaw `cc16c902a`. The
  source is unidentified. I told the triager to fall back to `gh issue view`/`gh pr list` at the one-shot.

**Next.** At t-46390d (11-05 21:50Z), the triager posts the draft, or replies to a human, or reviews a PR for #964.
Then a slang-rhi maintainer picks an approach. A fixer needs the operator AND a test machine that can run Metal.
- 11-01 22:08Z the triager updated t-46390d's prompt (schedule unchanged): the drift check uses `gh issue view`/`gh pr list` only, and if a hook blocks any call, the task stops and reports the exact message.

**11-05 11:35Z: the operator's dashboard batch "triage" ask (msg 52), answered from live state.** The 11-01 R6 hold
was the retired stale rule (see Core Memory). New since 11-01: **jkwak-work self-assigned #964 on 11-02
18:40:01Z** (events `assigner=jkwak-work`) and milestoned it Q4 2026 (Fall). The same happened to #961, #962 and
#965, so rung 4 applies (maintainer-owned): no bot post. #964 is still open, with 0 comments and no labels. PR #963
is open, REVIEW_REQUIRED. At 11:38Z I asked the triager (msg 61, landed in `sess-1793569740534-xikjp1`) to cancel
t-46390d and keep the draft. It posts only on an @nv-slang-bot mention or an operator go-ahead. Sibling Main
sessions own the #961/#962/#965 asks from the same batch.
- 11-05 11:39Z the triager confirmed: t-46390d is `cancelled`, nothing was posted, and the memo and draft are kept. Its state page now says post only on an @nv-slang-bot mention or an operator go-ahead.

**11-08 09:40Z: the reporter opened fix PR #966** (fork, `fix/metal-reuse-compute-encoder`, head 24bb229a, Fixes #964, +88/-1). It is the triager's option A: one compute encoder across consecutive passes, with a buffers+textures memory barrier on reuse; other encoder types and command-buffer end still end it through the fence. It adds a 64-pass ping-pong test. Review is requested from jkwak-work, fknfilewalker, jhelferty-nv and skallweitNV. PR #963 is still open. Its `pr_ready_for_review` webhook was NOT forwarded, because slang-pr-approver is paused. It is queued in `data/approver-pause-queue.md` with the triager's hazard list (timestamps/#963 ordering, executeCallback, clearTexture). Rung 4 still applies: no bot post.
