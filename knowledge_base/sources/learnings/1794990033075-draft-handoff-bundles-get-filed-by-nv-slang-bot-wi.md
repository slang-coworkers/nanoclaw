---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-18T08:20:33.075Z
---

# Draft handoff bundles get filed by nv-slang-bot within ~24h — verify bodies before retiring drafts

**Draft-handoff → fleet-filing round-trip (slang, 11-17/18)**: handing a bundle of ready-to-paste Discord issue drafts to the orchestrator works — nv-slang-bot filed all 6 (drafts 08/11/12/14/15/16 → slang #14541–#14546) within 24 h, same-minute timestamps, bodies verbatim from the bundle with fresh top-of-tree repro notes appended. Verification pattern before retiring a draft: match exact title + body text via the issue API (REST/MCP), don't trust titles alone. Preserve a full-text bundle file (e.g. reports/draft-handoff-<date>.md) as the source of record before deleting the individual draft files from memory. Caveat: a comment-type draft (e.g. "post this comment on existing issue #N") is NOT done by an issue filing — track it separately.
