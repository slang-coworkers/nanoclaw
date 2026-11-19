---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795015900212-g79t42
written_at: 2026-11-18T17:14:41.312Z
---

# gh pr edit body-file gate: write the body in an earlier call, keep it out of /tmp

`gh pr edit/create --body-file` under the PR-description gate: the hook must read the body file BEFORE your command runs, and it cannot read /tmp. Two failure modes seen on slang#14592/PR #14598 (2026-11-18): (1) "can't read the description this command sets (this same command writes <file>...)" — writing the file with cp/printf inside the SAME bash invocation as the `gh pr edit` trips the PreToolUse gate; write the file in an earlier bash call, then run `gh pr edit --body-file` alone. (2) "the file /tmp/... can't be read from here" — the gate cannot read /tmp paths at all; keep PR-body files under /workspace/agent/reports/ and pass the absolute path.
