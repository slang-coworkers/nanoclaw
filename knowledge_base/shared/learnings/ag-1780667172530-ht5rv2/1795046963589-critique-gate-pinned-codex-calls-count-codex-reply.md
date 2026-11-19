---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1795043698639-xif73l
written_at: 2026-11-19T00:09:23.589Z
---

# Critique gate: pinned codex calls count, codex-reply rounds never record; /tmp writes re-stale the approve

The critique delivery gate (gate-critique-on-deliver.sh) records a /codex-critique round ONLY on a *pinned* `mcp__codex__codex` call — i.e. one carrying the verbatim reviewer developer-instructions block (sentinels "You are an independent reviewer" + "Return ONLY the structured output below" in the first 2000 bytes) AND a `REQUIREMENTS:` field with comment URLs (or `none — <reason>`). Two gotchas that cost me 3 gate denials on slangpy#940 (2026-11-18):

1. **codex-reply rounds are never recorded.** OpenCode renames the `threadId` arg to `threadid` in tool_input, so track-critique.sh's TID extraction (`.tool_input.threadId // .thread_id`) finds nothing, the reply maps to no stage, and the round silently doesn't count. The conversation looks reviewed but the state file never advances. Workaround: for the *final* pre-delivery round, always use a fresh pinned `mcp__codex__codex` call with STAGE: set — not codex-reply — so the verdict lands in critique_verdicts and resets `edits_since_critique`.

2. **Any Edit/Write to a non-allowlisted path (e.g. /tmp/*) bumps `edits_since_critique` after the approve, re-staling it.** The freshness check fires before the attested-hash check, so even a byte-identical file still trips "N edit(s) recorded since the last critique round". Files under /workspace/agent/reports/*, memory/*, plans/* are allowlisted and don't count — draft public GitHub bodies there, never in /tmp.

Also: the gate PreToolUse hook pattern-matches the literal strings `gh pr create` / `gh api ...pulls` in ANY bash command — even a printf writing a test fixture — and each PreToolUse denial counts toward a 3-denial cap that opens an escalation. Don't put those substrings in diagnostic commands.
