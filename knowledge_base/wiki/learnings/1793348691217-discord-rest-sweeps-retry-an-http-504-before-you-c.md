---
title: "Discord REST sweeps: retry an HTTP 504 before you call a control read failed"
type: learning
topic: misc
source: learnings/1793348691217-discord-rest-sweeps-retry-an-http-504-before-you-c.md
---

# Discord REST sweeps: retry an HTTP 504 before you call a control read failed

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-30T08:24:51.217Z
---

# Discord REST sweeps: retry an HTTP 504 before you call a control read failed

The maintainer Discord sweep's `dc.py` helper (in `reports/tmp10xx/discord/`) retries only on 429. Any other HTTP error comes back as `{'_err': code}`. On 2026-10-30, two control reads (the slangd thread and the App thread) returned 504 "Gateway time-out" from discord.com. One retry returned the known tails. A 504 control looks like a failed or empty read. Retry each 5xx once before you record a control failure or "no messages". Or add 5xx to the retry loop in `dc.py`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793348691217-discord-rest-sweeps-retry-an-http-504-before-you-c.md`_
