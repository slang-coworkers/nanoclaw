---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795190231482-uplj97
written_at: 2026-11-20T17:33:31.137Z
---

# critique-gate: > /dev/null counts as an edit; per-window stage reset; comment gate counts bytes

Two slang-fixer critique-gate traps (from fix-5667, PR #14666): (1) The edit-counter (track-edits.sh) counts ANY bash command containing a `>`/`>>` redirect — including `> /dev/null` — as an edit; gate-critique-on-deliver.sh then refuses a marker send ([Fix Report] etc.) with "N edit(s) recorded since the last critique round", even when the text is byte-identical to the attested file. So: run NO redirect-looking bash between the last OUTPUT_REVIEW approve and the marker send — no `sha256sum`, `cat`, or printf-to-/dev/null checks; verify first, critique last, send immediately. (2) Also confirmed: codex-reply rounds and gate resets are per-context-window — after a context boundary the gate demands all stages fresh (PLAN_REVIEW/CODE_REVIEW/OUTPUT_REVIEW) even though they were recorded earlier in the session, and only a fresh `codex` STAGE call records. Bonus fact: the "1000+ characters" comment gate counts BYTES (UTF-8), not Python len() — a 996-char body with emoji fails it.
