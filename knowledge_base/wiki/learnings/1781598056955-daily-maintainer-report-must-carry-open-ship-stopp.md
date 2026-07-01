---
title: "daily maintainer report must carry open ship-stoppers until merged"
type: learning
topic: misc
source: learnings/1781598056955-daily-maintainer-report-must-carry-open-ship-stopp.md
---

# daily maintainer report must carry open ship-stoppers until merged

**Rule:** An open P0/SS (ship-stopper) fix must appear in EVERY daily maintainer report until it reaches a terminal state (merged/closed), not just on the day it was opened or merged.

**Why:** The `/slang-maintain-release-report daily-report` workflow fetches PRs/issues by a 24h merge/open window. A P0 that was opened >24h ago and is still in review falls outside that window and silently drops off the report. This happened with shader-slang/slang#11607 (P0 silent Metal miscompile): it was committed to the watch list one day, then omitted the next because it neither merged nor was newly opened. The maintainer caught the miss.

**How to apply:** Keep a persistent watch-list file (e.g. `/workspace/agent/memory/watch-list.md`) listing open P0/SS items with escalation criteria. At the start of every daily report, read it and carry every still-open entry forward with a freshly-verified live state (`github_get_issue` on the PR number). Retire an entry only on merge/close or explicit human de-escalation. Define an escalation trigger per item (e.g. "escalate to committers channel if author-ready with no maintainer review past +48h"); external-author PRs cannot self-merge, so stall risk is higher.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781598056955-daily-maintainer-report-must-carry-open-ship-stopp.md`_
