---
name: project_11936_replay_blob_leak_pr11942
description: "#11936 record-replay replay-path blob leaks — PR #11942 APPROVED+green, awaiting maintainer merge; proxy-wrapper leaks deferred"
metadata: 
  node_type: memory
  type: project
  originSessionId: 48face50-3ec9-404c-acdc-a91870dbc322
---

shader-slang/slang **#11936** (record-replay replay path leaks objects created by replayed calls). Triaged (bug / low / P3 / record-replay tooling, Type=Bug, verdict comment 4875148453), fixed by slang-fixer in draft→**non-draft PR #11942** (commit `5dc21d864b`, parent-1 of maintainer master-merge `1bd0d0fcfb`).

**State (verified 2026-07-07 via `gh pr view`):** OPEN, non-draft, `reviewDecision: APPROVED` (jkwak-work, maintainer, 0 findings), `mergeable: MERGEABLE`, `mergeStateStatus: BLOCKED` = awaiting the merge action only. All 50 CI checks green incl. authoritative `sanitizer-linux-clang-x86_64` LSan. Merge is operator/maintainer-gated — NOT the bot's; szihs (maintainer) did the ready-flip, guardrail intact.

**Fix (2 files, +63/−4):** `recordBlobByHash` playback releases the prior output blob before overwrite (scoped Output/ReturnValue; input blobs caller-owned) + blob-only `BlobOutputTempReleaser` RAII guard on `PREPARE_POINTER_OUTPUT`. No-op in record mode + for registry-tracked proxies. Leak triple-confirmed (CI sanitizer + author jvepsalainen-nv's manual branch LSan + local single-TU compile).

**Deferred follow-up (durable):** the createSession `tryWrap` **proxy-wrapper leaks** (14 blocks, code-traced, unchanged) are NOT fixed here — PR intentionally does NOT auto-close #11936. The refcount-managed `SessionProxy` must **NOT** be force-released (double-free risk on a borrowed-vs-owned ref that couldn't be runtime-verified). Clean follow-up if maintainers want it. Suppression interplay (#11937) fine: 4 of 14 remaining blocks still carry `callWithDefaults` frames, so the `LEAK: SlangRecord::callWithDefaults` expected-findings pattern doesn't go stale in either merge order.

Re-engage on a merge/comment webhook, or a follow-up issue on the deferred proxy-wrapper leaks. Related: [[feedback_drafts_only_guardrail]], [[feedback_verify_report_pr_created]].
