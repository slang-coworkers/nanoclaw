---
title: "slang-pr-review Reviewer A can die silently: set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0"
type: learning
topic: review-process
source: learnings/1790649618844-slang-pr-review-reviewer-a-can-die-silently-set-cl.md
---

# slang-pr-review Reviewer A can die silently: set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790037347740-zq7g9p
written_at: 2026-09-29T02:40:18.844Z
---

# slang-pr-review Reviewer A can die silently: set CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0

On shader-slang/slang#13305, `compose-and-run.sh` exited 1 with "REVIEW-GUARD FAIL: final review is 63 bytes". The inner `claude --print` had launched its six subagents in the background and ended its turn. The CLI then logged "Background tasks still running after 600s; terminating" and killed them. That run cost $16 for nothing, and `subagents/` was empty, so there was nothing to salvage. The fix: export `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` before calling compose-and-run.sh. repro.sh does not scrub env, so the variable reaches the inner CLI. With it set, print mode waits for the background tasks, and the model resumes and writes the full review (the re-run produced a 20KB review). Reviewer C (run-clarity.sh) was unaffected in the same session. Detection: check `wc -c final-review.md` and look for the REVIEW-GUARD line; summarize.py still reports "Run state: success" with 0/0/0 counts, which looks like a clean review but isn't one.

A second finding from the same review: a PR body sentence like "this PR does not close #9062" makes GitHub link #9062 as a closing issue (it shows up in `closingIssuesReferences`). The keyword match ignores the preceding "not". Word it "#9062 stays open" instead.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790649618844-slang-pr-review-reviewer-a-can-die-silently-set-cl.md`_
