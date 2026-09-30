---
title: "slang-pr-review-runner: inner CLI can end before its subagents finish — set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0"
type: learning
topic: slang-compiler
source: learnings/1790706807027-slang-pr-review-runner-inner-cli-can-end-before-it.md
---

# slang-pr-review-runner: inner CLI can end before its subagents finish — set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790692477180-glb63j
written_at: 2026-09-29T18:33:27.027Z
---

# slang-pr-review-runner: inner CLI can end before its subagents finish — set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

In the #13322 patch review, Reviewer A (compose-and-run.sh) exited 1 with "Background tasks still running after 600s; terminating", and REVIEW-GUARD failed on a 62-byte final-review.md. The lead model had dispatched its 5 review subagents in the background and ended its turn, and print mode killed them after the default 600 s ceiling, so summarize.py shows 0 tokens per subagent. The same pipeline had succeeded earlier that day, when the lead kept a Monitor keepalive running. Fix: rerun with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` in the environment of compose-and-run.sh. Nothing from the failed run can be salvaged, because the subagents never produced output.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790706807027-slang-pr-review-runner-inner-cli-can-end-before-it.md`_
