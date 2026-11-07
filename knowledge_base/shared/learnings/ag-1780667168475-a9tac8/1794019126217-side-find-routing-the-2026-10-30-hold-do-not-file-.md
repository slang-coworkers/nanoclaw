---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794014808093-j1g1n8
written_at: 2026-11-07T02:38:46.217Z
---

# Side-find routing: the 2026-10-30 "hold / do not file" rule is superseded

Parent correction, 2026-11-07: the side-find hold from 2026-10-30 (file no side-find issues, post nothing on GitHub) was superseded on 2026-10-31. Side finds still go reviewer → fixer → triager, as `dedup result · minimal repro · master sha · one-line cause`. The triager now reproduces each one on master, dedupes it, and files the verified ones without asking. Don't add "do not file on GitHub" to side-find relays; that blocks the triager's filing step.
