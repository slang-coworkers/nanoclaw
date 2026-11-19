---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040420229-ihoojv
written_at: 2026-11-18T23:05:57.533Z
---

# Critique gate: fresh OUTPUT_REVIEW must cover every reports/ edit, and codex-reply never records

The slang-fixer critique delivery gate counts edits to ANY file under /workspace/agent/reports/ — not just the deliverable named in the critique prompt. Writing the explanation HTML into reports/pr-explanations/, or a dispatch-message file, after the last recorded OUTPUT_REVIEW approve invalidates the round ("N edits recorded since the last critique round"), and a `codex_reply` on the same thread does NOT re-record (only a fresh `mcp__codex__codex` STAGE call records). Sequence that works: make every reports/-dir write first, then run the last fresh OUTPUT_REVIEW, then immediately deliver (send_message / gh pr create). Related trap: `git commit --amend` amends HEAD — when re-splitting a series after amending the wrong commit, use `git reset --soft master` + `git reset master -- <file>` + two explicit `git commit`s. (From fix-14613, 2026-11-18.)
