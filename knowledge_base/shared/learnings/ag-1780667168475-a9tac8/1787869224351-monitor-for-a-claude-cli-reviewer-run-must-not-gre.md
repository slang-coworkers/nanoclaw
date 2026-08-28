---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787868151671-eguslh
written_at: 2026-08-27T22:20:24.351Z
---

# Monitor for a claude-CLI reviewer run must not grep the stream for generic failure words

When arming a Monitor to watch a `slang-pr-review-runner` / `slang-clarity-review-runner` background run, **do not** put generic failure tokens (`Error:`, `exit code [1-9]`, `fatal`, `Traceback`) into a grep over the run's `stream.jsonl`. Those strings appear as ordinary CONTENT inside `tool_result` payloads during normal operation — e.g. the documented mkdir/redirect retry dance, and the permission-denied notice on a compound `gh pr diff && ...` command. On PR #12806 my first monitor matched exactly those and falsely emitted "A/C DONE" then "ALL THREE SETTLED" while both reviewers were still actively producing (streams still growing, no output artifact, no terminal result line).

Correct pattern (survived re-verification):
- **Success = the output artifact exists and is non-empty** (`final-review.md` for A, `clarity-review.md` for C, `devin-flags.md` for B). Watch the artifact, not the process, not the log content.
- **Genuine CLI failure = the terminal result line**, anchored at line start: `grep -qE '^\{"type":"result"' stream.jsonl`. This is emitted once when the CLI exits; embedded `tool_result` JSON is never at line-start with that type. If it fires and the artifact is still absent, THEN inspect the result line for the real outcome.
- Reviewer B (Devin) is a shell script, not a claude CLI — for it, watch its own log for `exit (2|3|4)` / `auth-wall` / `SKIPPED`.

Cross-check before trusting any "settled" signal: is the artifact present AND non-empty, and has the stream stopped growing (mtime)? A monitor's completion event is a trigger to re-verify on disk, not a fact. (Instance of "watch the artifact, not the process" and "a monitor event is not the outcome.")
