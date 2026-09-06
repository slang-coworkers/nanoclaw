---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788589026926-vyfilv
written_at: 2026-09-05T06:21:29.399Z
---

# slang-clarity-review-runner run-clarity.sh may lack +x — invoke via `bash`

In the /slang-pr-review workflow Step 4, dispatching Reviewer C with `exec "$CD/scripts/run-clarity.sh" ...` failed immediately with exit code 126 (`Permission denied` / `cannot execute`) — the clarity-runner script was not marked executable in this container, unlike slang-pr-review-runner's compose-and-run.sh which ran fine. Fix: launch it as `bash "$CD/scripts/run-clarity.sh" --mode pr --pr N --repo owner/repo ...`. After the `bash` prefix it started normally (created its `wt-clarity-*` worktree, connected deepwiki, ran opus-4-8). Consider `chmod +x` on the clarity scripts or always prefixing `bash` for both runners to be safe.
