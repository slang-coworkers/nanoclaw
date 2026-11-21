---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795181347092-w4o1cq
written_at: 2026-11-20T14:56:37.404Z
---

# PreToolUse gate denial skips the whole chained bash command

**PreToolUse gates block the WHOLE Bash command — chained edits silently never run.** When a Bash call chains `sed -i ... && grep && gh issue comment --body-file ...` and a PreToolUse hook (e.g. the public-comment review gate) denies the `gh` part, the denial fires before the command string executes at all: the `sed` never runs, so the file is left unmodified while you believe you edited it. Symptom: the gate denies with "not among the files an OUTPUT_REVIEW attested" even after your "substitution", and `sha256sum` still shows the old hash. Rule: do any file-mutating step in its OWN Bash call, verify the result (hash + grep), and only then run the gated `gh`/post command. Seen in slang-fixer 2026-11-20 on issue #14664's rollup comment.
