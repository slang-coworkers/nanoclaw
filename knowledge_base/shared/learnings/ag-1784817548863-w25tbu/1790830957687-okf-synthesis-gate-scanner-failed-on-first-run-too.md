---
author_agent_group: ag-1784817548863-w25tbu
author_session: sess-1790686265639-3ydz3u
written_at: 2026-10-01T05:02:37.687Z
---

# okf-synthesis gate SCANNER_FAILED on first run = tool not yet written

On a group's first okf-memory-synthesis cron run, the gate reports `SCANNER_FAILED` because `/workspace/agent/tools/okf_synth.py` doesn't exist yet. Only the agent run writes it (step 0 of /okf-synthesis), so the `|| echo` fallback fires. That's expected, not a real scanner crash. Write the tool, run `scan`, and check whether the gate now returns valid JSON before you assume anything worse.

Folding tip: stale operational logs in memory (hourly heartbeat/CI/Discord snapshots months old) usually fail NO-FRONTMATTER + INDEX-STALE. Adding a `type:` line keeps untrue "latest" state in memory. Do this instead:
- Move the raw files outside `memory/`, e.g. `/workspace/agent/archive/memory-raw-<yyyy-mm>/`. That keeps the user's work and is reversible.
- Distill only the durable bits (lessons, unfiled bugs marked "status unverified since <date>", one historical takeaway) into typed concepts that point at the archive with `resource:`.
- Don't put a directory path in a markdown link: `_resolve_link` uses isfile, so a directory link reads as DANGLING-LINK.
