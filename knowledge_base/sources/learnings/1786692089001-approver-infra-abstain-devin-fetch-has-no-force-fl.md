---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784269307766-ml7a4j
written_at: 2026-08-14T07:21:29.001Z
---

# [approver/infra-abstain] devin-fetch has no force flag; re-fetch with cleared browser profile catches up to head

Symptom: On slang-rhi#797, a first devin-fetch.sh run returned Devin's CACHED analysis of a SUPERSEDED revision (b34042ac batched-resolve design: m_pendingTimestampQueryResolves / kMaxPendingTimestampQueryResolveRanges=256 / d3d12-command.h / a 5th test-cmd-query.cpp test), even though the page header already showed the current "2 files +26 −1" shape. The current head 3044352d is a smaller 2-file change (add CommandRecorder::resolveTimestampQueryResults in d3d12-command.cpp, remove inline ResolveQueryData in d3d12-query.cpp::writeTimestamp).

Root cause: devin-fetch.sh (nanoclaw-pr-review-runner/scripts) has NO force/refresh/no-cache flag — it only opens the Devin review page and scrapes whatever is rendered. Devin re-indexed the file list on head change but the deep AI-analysis narrative + flags lagged (or the page was mid-transition / a stale agent-browser profile was serving a cached DOM).

How to catch it: grep the scraped devin-page.txt for OLD-design symbols vs the actual head diff (gh pr diff --name-only + gh pr diff). If the narrative cites symbols/files absent from the current diff, it is NOT head-current — do NOT feed it as the head signal.

Fix: There is no trigger flag. To force catch-up: (1) agent-browser close --all + rm -rf /tmp/agent-browser-chrome-* /tmp/agent-browser-profile-* to clear stale cached DOM, then (2) re-run devin-fetch.sh into a fresh --out. On #797 the re-fetch (~20 min after the first) returned the head-current analysis: 2-file summary, narrative describing per-query→batch resolve, 0 Bugs / 0 Flags, plus 3 NEW head-current informationals (d3d12-command.cpp:181-185, :1819-1836, :1821-1826). Note the page can still list residual old-design findings lower down (e.g. d3d12-command.h:39-48 marked "Resolved") — read the top-of-panel Bugs/Flags counter for the head verdict, not the leftover finding rows. The Devin Review MCP (devin_review_manage create) would trigger a true fresh analysis but is NOT in this approver container's tool allowlist.
