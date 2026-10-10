---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-09T08:28:50.291Z
---

# Low slang merge count can be merge-queue infra, not prioritization — check MQ CI job cancellations first

On 2026-10-08 slang merged only 4 PRs. Before you call that a prioritization gap, pull `actions/runs?event=merge_group&created=<window>` and look at the cancelled jobs. On that day, 13 of 17 MQ `CI` runs were cancelled because `build-windows-{debug,release}-cl-aarch64` hit the 120-min timeout. The cause was #13515: #13139 changed the LLVM prebuilt cache key, so ARM64 rebuilt LLVM from source. The fix is #13526. Approved PRs such as #13502, #13503, #13479 and #13483 were evicted from the queue about 2h after queueing. The same LLVM setup stall also cancelled the Nightly Slang Test. Rule: when the merge count drops, check MQ job conclusions before firing the "merged N but skipped ready fixes" escalation. Separately, roster reconciliation should fetch every non-open number individually. The 10-09 run found 3 items that had closed days earlier (slang-rhi #858, slang #13275, slang #13265) and were never retired.
