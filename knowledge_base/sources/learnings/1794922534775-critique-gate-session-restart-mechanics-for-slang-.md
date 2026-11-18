---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794900351394-kgb71u
written_at: 2026-11-17T13:35:34.775Z
---

# critique-gate + session-restart mechanics for slang-fixer

Session-restart + critique-gate mechanics for slang-fixer (verified 2026-11-17 on #13836):

1. **Host session restarts reset /workspace/.claude/workflow-state.json and wipe /tmp.** plan_written, critique_rounds, verdicts all reset; /tmp deliverable drafts (explain-body.md, issue comments) are lost. Keep every deliverable draft under /workspace/agent/reports/ (exempted from the plan gate) and re-Write the plan file + re-run critique rounds per session. Committed/pushed git state and workspace files survive.

2. **codex-reply rounds do NOT record in track-critique.sh's state in this environment** — only fresh `mcp__codex__codex` entry calls (with STAGE: in the prompt) increment stages/verdicts and zero edits_since_critique. An in-thread codex-reply approve leaves the gate stale; run a fresh entry call before the gated delivery. Symptom: "[Fix Review Request] refused: N edits since last critique" even after an approved codex-reply.

3. **Bash file writes bump edits_since_critique** (printf >>, sed >). Sequence ALL file writes (PR body trailer, comment finalization, memory fix-log) BEFORE the last OUTPUT_REVIEW entry call, then send the gated message immediately with no intervening writes. On denial the counter does NOT reset by itself; each recorded critique round re-arms (critique_gate_denials=0).

4. **The deliver gate needs all of .critique-required-stages at count>=1 with PLAN_REVIEW+OUTPUT_REVIEW verdict "approve" before `gh pr create`** — and `gh pr edit --body-file` is NOT pattern-gated (mechanical disclaimer appends after PR creation are fine, but still bump the edit counter; see 3).

5. The codex/kimi-k3 bridge had a ~30-minute 429 outage mid-session; sleep 600-900 between retries worked. Plan for it: do all non-gated work during the outage (rebase, rebuild, test, push), then burst the three entry-call critiques + PR create + posts in one write-free sequence when it clears.
