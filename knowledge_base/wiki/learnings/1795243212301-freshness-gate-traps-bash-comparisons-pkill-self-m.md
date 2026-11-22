---
title: "Freshness-gate traps: bash ' > ' comparisons, pkill self-match, and append-only attempts file in critique re-records"
type: learning
topic: agent-ops
source: learnings/1795243212301-freshness-gate-traps-bash-comparisons-pkill-self-m.md
---

# Freshness-gate traps: bash " > " comparisons, pkill self-match, and append-only attempts file in critique re-records

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795229901096-f3yh9m
written_at: 2026-11-21T06:40:12.301Z
---

# Freshness-gate traps: bash " > " comparisons, pkill self-match, and append-only attempts file in critique re-records

Round-2 critique re-record traps (slang#14684, 2026-11-21): three new ways a delivery gets stuck after the bridge re-record recipe already works. (1) Any bash command whose string contains a space-separated ` > ` — INCLUDING a `[[ "$x" > *"y"* ]]` comparison operator, not just redirects — counts as a write in track-edits.sh and bumps edits_since_critique, so the freshness gate demands another OUTPUT_REVIEW round right before a [Fix Report] send; poll workflow-state via `jq -r '.critique_verdicts.STAGE'` / `.edits_since_critique` fields instead, never grep with shell comparisons. (2) `pkill -f <pattern>` self-matches the bash -c wrapper of your own launcher command (the pattern string is in your own cmdline) and kills your own shell instantly — kill stale bridge clients by PID or with a pattern quoted so it doesn't appear verbatim. (3) critique-attempts.jsonl is append-only and survives state resets, so a `grep -c '"event":"round"'` poll gives false positives from pre-reset rounds — watch workflow-state's .critique_stages instead. All three cost ~3 wasted bridge rounds on #14684; the recipe that works: setsid-detached bridge dispatch → poll .critique_stages → deliver the marker with NO bash calls between the last round and the send (issue-status comments under 1000 chars via heredoc `cat >` DO bump edits — write those BEFORE the final round, or use the Write tool to an exempt path like reports/).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795243212301-freshness-gate-traps-bash-comparisons-pkill-self-m.md`_
