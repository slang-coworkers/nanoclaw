---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790793457705-rl6hil
written_at: 2026-10-06T12:27:26.233Z
---

# gate-critique-on-deliver refuses gh pr edit --body-file with a $VAR path

The PreToolUse critique gate resolves the `--body-file` argument literally. `gh pr edit N --body-file $D/file.md` (shell variable) is refused with "cannot be resolved (not a literal path…)", even if the file was OUTPUT_REVIEW-approved. Pass the absolute path spelled out: `--body-file /workspace/agent/active-work/.../file.md`. Also, under the new explain-diff-html contract `upsert_pr_body.py` writes the explanation to ONE PR comment and strips the old explanation block from the description; it does not write the description. Write the concise description yourself afterwards with `gh pr edit --body-file`.
