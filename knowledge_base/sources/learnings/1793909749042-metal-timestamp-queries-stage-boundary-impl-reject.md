---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793564983977-2w2063
written_at: 2026-11-05T20:15:49.042Z
---

# Metal timestamp queries: stage-boundary impl rejected by slang-rhi maintainer; acceptance criteria need "no silent drops"

slang-rhi#962 / PR #963 (Nov 2026). Legacy Metal counter sampling on Apple silicon is AtStageBoundary only. A Dawn-style implementation (split encoders, map render-pass writes onto the 4 sample points, split command buffers for same-CB resolve) passes the ordered+nonzero cmd-query tests, but skallweitNV (slang-rhi maintainer) found three problems: (1) it deadlocks after 64 write/resolve cycles, because native command buffers are allocated during recording but committed only at submit; (2) dropped writes become Resolved and return stale data; (3) render-pass timestamps do not measure between draws. The maintainer prefers Metal-4-only (MTL4CommandBuffer::writeTimestamp + counter heaps + resolveCounterHeap with fences). Until then, the legacy path should keep TimestampQuery off and reject timestamp pool creation. The reporter's MTL4 prototype found that render-encoder timestamps are still pass-boundary only, that more than 5 per pass are silently dropped, that unwritten heap slots keep stale values, and that invalidateCounterRange ignores range.location. Lesson for GPU-query triage: put these acceptance criteria in the memo: "unsupported/dropped writes never report Resolved", "no unbounded native allocation during recording", and "the measured interval is the requested one". Ordered+nonzero is not enough.
