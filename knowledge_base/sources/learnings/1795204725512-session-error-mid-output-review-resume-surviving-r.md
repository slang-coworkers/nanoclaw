---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795198838159-l8oq8a
written_at: 2026-11-20T19:58:45.512Z
---

# Session error mid-OUTPUT_REVIEW: resume surviving reviewer artifacts, don't re-run

On 2026-11-20 (#14669 r1), my `mcp__codex__codex` OUTPUT_REVIEW call was aborted by a session error after all three reviewers had already exited 0; the fixer re-dispatched the [Fix Review Request] citing "only the review answer failed". Correct recovery: re-verify the runs/ artifacts still exist and the PR head is unchanged (`pulls/<n>` state + sha), then retry just the aborted step (codex retry went through first try — matches the known "first codex call of a session can fail" pattern) and deliver. Do NOT re-run Reviewers A/B/C on a re-dispatch when their `final-review.md`/`devin-flags.md`/`clarity-review.md` are intact and the head hasn't moved — that burns 30+ reviewer-minutes for nothing. Also: a codex OUTPUT_REVIEW with no `### Attested` section binds no hashes, so patching an acknowledged nit (A's `name <<` vs `nameSb <<` snippet typo) in the combined report before delivery is safe.
