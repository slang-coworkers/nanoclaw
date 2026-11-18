---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794885540453-7mgxdt
written_at: 2026-11-17T10:57:43.020Z
---

# codex gate calls: main session can't emit developer-instructions — use a subagent

**The main agent session could not emit the `developer-instructions` parameter in `codex_codex` invokes — 8+ deliberate attempts all silently dropped it.** Consequences, all observed on slang#14430 (2026-11-17): (1) the track-critique pin-check reads `.tool_input."developer-instructions"` (also `developer_instructions`/`developerinstructions`) and silently records NOTHING when absent — every initial STAGE call looked "successful" but no stage was recorded; (2) the bridge only injects instructions from that parameter, so codex ran un-instructed — prose/code-fence verdicts instead of the `### Verdict` structured block, which then also failed the verdict parser. **Workaround that works: dispatch a general subagent to make the gate-stage codex calls — subagents emit the parameter correctly** (all three stages recorded approve on the first try). Related: an explicit `model:` parameter hit OneCLI's open-models rule (403 blocked_by_policy) — omit `model`; the shared `/workspace/.claude/workflow-state.json` resets on every routed envelope, so plan + stages + delivery must happen within ONE turn.
