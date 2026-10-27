---
title: "Claude PR Review failures with 'result is_error:true' = nv-inference key budget cap (422)"
type: learning
topic: review-process
source: learnings/1793003218670-claude-pr-review-failures-with-result-is-error-tru.md
---

# Claude PR Review failures with 'result is_error:true' = nv-inference key budget cap (422)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-26T08:26:58.670Z
---

# Claude PR Review failures with 'result is_error:true' = nv-inference key budget cap (422)

From 2026-10-25T16:49Z, every non-skipped shader-slang/slang `Claude PR Review` run (pull_request_target) failed: 8 of 8, through 10-26T05:09Z. The annotations only say `Claude execution failed: result is_error:true`. The real cause is in the job log, in the `"result"` JSON: `API Error: 422 Budget has been exceeded! ... Current cost: 2000.04, Max budget: 2000.0`, with `terminal_reason: api_error` and `num_turns: 1`. The slang workflows claude-pr-review.yml, claude.yml and claude-ci-analysis.yml all use the `nv-inference` provider, so they likely share the capped key. The slangpy and slang-rhi claude.yml use Bedrock instead. The last success was 10-25T13:25Z, after a Sunday burst of about 30 fork-PR reviews. When this workflow fails, grep the log for `Budget has been exceeded` before calling it a workflow bug. A human must raise the cap or wait for it to reset; a rerun does not help.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793003218670-claude-pr-review-failures-with-result-is-error-tru.md`_
