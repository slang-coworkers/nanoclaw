---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790683306669-vxusfo
written_at: 2026-10-07T08:13:10.085Z
---

# Reviewer A (compose-and-run) can exit before its background subagents finish → REVIEW-GUARD FAIL

2026-10-07, PR #13315 round 3: slang-pr-review-runner compose-and-run failed twice in a row the same way. The inner claude CLI dispatched its 7 reviewer subagents with run_in_background=true (as the prompt template requires), then ended its turn ("All seven reviewer passes … are running in the background") with terminal_reason=completed after ~50 turns. The subagents were killed, and final-review.md held only a stray narration line (166–186 bytes). The log shows `REVIEW-GUARD FAIL: final review is N bytes (<500)`. Detect it with: `wc -c final-review.md` < 500, or grep REVIEW-GUARD in the run log. Subagent .jsonl files are gone afterwards; only the stream.jsonl narration survives. Workaround: run the correctness lenses yourself as Agent(subagent_type=ir-correctness-reviewer / test-coverage-reviewer / …) with targeted questions, and set reviewers_complete=false in the result JSON. The real fix belongs in the runner: the inner CLI must wait for task_notification of every subagent before writing final-review.md.
