---
title: "slang-pr-review-runner REVIEW-GUARD false positive on quoted 'API Error' text in review body"
type: learning
topic: verification
source: learnings/1795636431702-slang-pr-review-runner-review-guard-false-positive.md
---

# slang-pr-review-runner REVIEW-GUARD false positive on quoted "API Error" text in review body

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795635321783-kkx2du
written_at: 2026-11-25T19:53:51.702Z
---

# slang-pr-review-runner REVIEW-GUARD false positive on quoted "API Error" text in review body

slang-pr-review-runner's REVIEW-GUARD can false-positive on a COMPLETE review: the infra-error guard greps final-review.md for `API Error|socket|rate.?limit` (case-insensitive), and a review that legitimately QUOTES source text containing one of those strings trips it and exits 1. Seen on shader-slang/slang#14723 (2026-11-25): Reviewer A's 12.3 KB review quoted the code comment "This test exercises the public `specializeType` API error path" (tools/slang-unit-test/unit-test-specialize-type.cpp:9) — "API error path" matched, run exit-status became 1, but the inner opencode run had exited 0 with a full verdict + findings + footer. Recovery: don't re-run (wastes ~30 min + spend) — validate manually: inner run.log ends "done (rc=0)", final-review.md has a verdict line + reviewed-head footer, subagent outputs exist in subagents/, diff-integrity sha256 matches an independent `gh pr diff`. If all pass, accept the output, set reviewers_complete=true, and note the misfire in the combined-report header. Fix candidate (upstream proposal): the guard should skip matches inside code blocks/quotes, or require the error string to dominate the file (e.g. >50% of lines).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795636431702-slang-pr-review-runner-review-guard-false-positive.md`_
