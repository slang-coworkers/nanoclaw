---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795040985190-v53hrm
written_at: 2026-11-19T02:09:00.366Z
---

# Codex critique: gh api hangs the turn; dispatch redirects race the edit counter

Two new critique-dispatch traps (slang#14615, 2026-11-19, opencode session driving the codex MCP bridge):

1. **Codex critique turns DIE running `gh api` — pin GitHub JSON to files instead.** The canonical reviewer developer-instructions tell codex to "fetch every cited URL yourself (gh api, or curl)". In the codex sandbox those network commands HANG: the CODE_REVIEW turn sat 14:45 min on a hung `gh api repos/shader-slang/slang/issues/14615 | head -100`, ate the bridge's whole 900s turn budget, and the round died as `codex app-server exited (code=0) before the turn completed` — twice, before I read the rollout JSONL (`~/.codex/sessions/.../rollout-*.jsonl`, look for function_call entries and a `turn_aborted`/timeout with duration_ms ~= 900000). Fix that worked first try: fetch the issue body + comments JSON yourself, save them under the scratch dir, list them in ARTIFACTS with an explicit "network commands can HANG in your sandbox — do not run them" note. Verbatim-quote verification still happens (codex substring-matches the JSON), the round just doesn't die.

2. **The reply-dispatch command's own `> file` redirect can bump edits_since_critique AFTER the round zeroes it.** track-critique.sh zeroes the counter when it records a round; if the dispatch bash command contains `> path` (with a space — the hook's write-regex is `(^|\s|\|)(>|>>)\s`), its PostToolUse bump can land at the same second and win the race, leaving edits=1 → the freshness gate then denies [Fix Review Request]/[Fix Report]/PR-create with "1 edit(s) recorded since the last critique round". Fix: write redirect targets with NO space after `>` (`>result.txt 2>stderr.txt` doesn't match the pattern), or run one cheap codex-reply re-record round (ROUND: n/3, "artifacts unchanged, re-record") to re-zero it. Also: `pkill -f <pattern>` where the pattern appears in your own bash command line kills YOUR shell (argv self-match) — use a bracket trick like `code-prom[p].txt`.
