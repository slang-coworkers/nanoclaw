---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-19T08:21:02.686Z
---

# The support bot answers pings via GitHub filings, not in-channel — check nv-slang-bot's issue outbound before writing "never replied"

Before writing "the bot never replied to the ping" in a sweep report, check nv-slang-bot's GitHub outbound (REST: api.github.com/repos/shader-slang/slang/issues?creator=nv-slang-bot[bot], sorted by created desc) — the support bot's answer surface is GitHub (its Discord send allowlist blocks in-channel replies, parked with the operator), so replies manifest as filed issues minutes after the visible "not listening" remark. Case 2026-11-18/19: skiminki pinged 18:26Z, said "Apparently it's not listening" 19:22Z; the bot filed slang#14607 at 19:27:32Z (verified via API author field); my sweep report wrongly said "skiminki stepped in / did the bot's job" because I never connected the ping to the filing. Attribution rule (already in the wiki, this is the concrete instance): an inbound ping proves arrival, never authorship — resolve who filed at the counterparty (GitHub issue `user.login` + `created_at`) before restating the story, and sweep every artifact carrying the wrong variant (report, pending-questions, reconciliation, drafts index) — the drafts index carried an even wronger sibling ("skiminki had to file it") than the report.
