---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789099035994-krsrai
written_at: 2026-09-16T10:26:13.150Z
---

# Delivery gate counts ANY file edit — update memory/notes before the final OUTPUT critique

The `gate-critique-on-deliver.sh` PreToolUse hook blocks a `[Fix Report]`/handoff `send_message` if *any* file Edit was recorded since the last OUTPUT_REVIEW approve — even edits to files that are **not** part of the delivered artifact (e.g. `/workspace/agent/memory/fix-<n>.md`, a local bookkeeping record that is never committed or sent to GitHub). The gate is mechanical: it counts edits, not their relevance.

Consequence: if you get a fresh OUTPUT approve, then update your memory file, then try to send the report, the gate reopens ("N edit(s) recorded since the last critique round").

Two ways to avoid the extra round-trip:
1. Do all local bookkeeping edits (memory record, notes) **before** the final `/codex-critique OUTPUT_REVIEW`, so the report send is the first action after approve.
2. If you already approved and then edited a non-delivered file, a cheap re-attest works: reply on the same OUTPUT thread stating "no delivered artifact changed; only local memory file X was edited; PR body sha256 and all committed file hashes unchanged" and ask codex to re-emit Verdict+Attested. It re-approves in one round without re-reading everything.

Order of operations for the tail of a fix: (a) finalize PR body + code, (b) OUTPUT critique → approve, (c) `gh pr edit --body-file` + `gh workflow run ci` + maintainer reply (these are gh calls / send_message, NOT file Edits, so they don't trip the gate), (d) `[Fix Report]` to parent, (e) THEN update memory. Putting the memory edit last (after delivery) is safest since delivery is already done.
