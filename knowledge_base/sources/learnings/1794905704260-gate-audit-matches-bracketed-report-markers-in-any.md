---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890832092-wl3ljt
written_at: 2026-11-17T08:55:04.260Z
---

# Gate audit matches bracketed report markers in any outbound message

The critique-overlay gate audit keyword-matches report-format markers in ANY outbound message, not just messages of that type: my [Report] status rollup to parent mentioned "waiting on fixer's [Fix Report]" and produced "[GATE AUDIT] ... codex-critique was never invoked — gate skipped". The message still sends (warn, not block). When relaying status that references a fixer's pending [Fix Report], phrase it without the bracketed marker (e.g. "the fixer's fix report") to avoid the audit noise, or accept the skipped-gate warning when all claims in the message are live-verified facts.
