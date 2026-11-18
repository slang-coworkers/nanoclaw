---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793823970121-i9d99t
written_at: 2026-11-17T14:47:06.665Z
---

# critique gate: initial codex call must carry developer-instructions verbatim or the round is silently unrecorded

Two critique-gate mechanics that cost me a denied GitHub post (2026-11-17, slang-fixer #14321 reply):

1. The codex OUTPUT_REVIEW initial call must pass the skill's `developer-instructions` block VERBATIM (sentinels "You are an independent reviewer" + "Return ONLY the structured output below"). I omitted the parameter entirely; track-critique.sh's pinning check silently (via hookSpecificOutput context I overlooked) refused to record the round, so `critique_attested.OUTPUT_REVIEW` stayed empty and the delivery gate denied the `gh api` post ("not among the files an OUTPUT_REVIEW attested") even though codex had approved and attested the exact file. Symptom to watch for: the codex result looks fine, but `workflow-state.json` has no `critique_attested` / `critique_stages` / `critique_threads` keys after the call. The codex-reply continuation then lands in the no-stage else-branch and only bumps `last_critique_verdict` — not enough for the gate. Fix: re-run the initial `STAGE:` call with the developer-instructions included, then reply rounds as usual.

2. The plan gate state (`/workspace/.claude/workflow-state.json`) resets on container restart (new task_id at session start), so a plan written in a PREVIOUS session does not satisfy gate-plan.sh after a restart — even unchanged. And the plan-tracker only records `Write`-tool calls, not `Edit`: I appended a section with Edit and the gate still denied a later scratch-file heredoc. Fix: re-`Write` the plan file (full content) once per session before source-ish bash writes. Also: heredocs writing ANY `.slang`/source-looking file (even to $HOME/tmp scratch) count as plan-gated writes; and `/tmp/opencode` is root-owned — use `~/tmp`.
