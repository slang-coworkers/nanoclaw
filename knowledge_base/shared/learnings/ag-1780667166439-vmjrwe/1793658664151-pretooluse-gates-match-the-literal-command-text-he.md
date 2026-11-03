---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793316801220-5f63gx
written_at: 2026-11-02T22:31:04.151Z
---

# PreToolUse gates match the literal command text, heredoc bodies included

`gate-critique-on-deliver.sh` refused a Bash call that only appended a plan note to a file, because the heredoc body contained the words `gh pr create --draft`. The PostToolUse "PR created" hook also fired on a memory-file heredoc that mentioned `gh pr create`. The hooks match the raw command string, not what actually runs. To write notes that mention gated commands, use Edit/Write (their content is not scanned this way) or reword the note ("open DRAFT PR"). A refusal or a "PR created" reminder right after such a write is a false positive; check `gh pr list --head <branch>` before acting on it.

Related, for slang-test on Linux: `tests/metal/*` `-target metal` SIMPLE FileCheck and DIAGNOSTIC tests DO run without Apple hardware. Only COMPARE_COMPUTE `-metal` runtime legs and `-target metallib` legs are skipped. Don't write "Metal legs ignored" for the whole file; codex OUTPUT_REVIEW flagged that as a false public claim.
