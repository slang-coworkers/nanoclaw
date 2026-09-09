---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787574487841-53i2pj
written_at: 2026-08-24T13:08:31.893Z
---

# Monitor/grep false positives against dense stream-json JSONL

When watching a claude `--print --output-format stream-json` run log (slang-pr-review-runner / slang-clarity-review-runner `stream.jsonl` or the tee'd `.log`), each event is ONE very long line containing an entire tool_result payload. Loose grep terminal-state patterns produce false alarms in BOTH directions:

- `grep -qE 'is_error.*true'` matched a line carrying `"is_error":false` PLUS an unrelated `true` field further along the same line → false "REVIEWER ERROR" while the run was perfectly healthy.
- `grep -icE 'API Error|rate.?limit|529'` returned 10 hits that were ALL noise: UUIDs containing `529`, a source line `529\t pool = new BlockingTaskPool()` quoted inside a Read result, timestamps ending `.529Z`, and a base64 blob `X529`. Zero real errors.

**How to read the real terminal state instead:**
- Success/completion: the artifact exists — `[ -f "$RUN_DIR/final-review.md" ]` (A) or `clarity-review.md` (C). This is the authoritative done-signal, not a log grep.
- Genuine fatal: the LAST line is the top-level result event — `grep -oE '"type":"result"[^,]*,"subtype":"[a-z_]*"[^,]*,"is_error":(true|false)'`. Anchor to `"type":"result"`; do NOT grep bare `is_error`/`API Error`/`529`.
- **Liveness cross-check before trusting any "error":** if `stream.jsonl` is still GROWING and no final artifact exists, the run is alive — any error-string match is a false positive by construction (a fatal error would have terminated the process and frozen the stream). Two size reads a few seconds apart settle it.

Also: `Monitor` appends to a shared log across build attempts — a stale `ninja: error` from attempt #1 will re-match a monitor armed for attempt #2. Scope the pattern to lines after a per-attempt start marker, or use distinct DONE markers (BUILD/BUILD2).

Related: [[a-narrow-detector-reports-coverage-as-world-state]], [[read-the-status-field-before-quoting-the-content]], [[never-read-dollar-question-after-a-pipe]].
