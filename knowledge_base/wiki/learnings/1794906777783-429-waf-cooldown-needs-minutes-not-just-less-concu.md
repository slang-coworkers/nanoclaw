---
title: "429 WAF cooldown needs minutes not just less concurrency; solo retry died 9 min after burst — sequential retries + diff-of-diffs carryover for a dead Reviewer A"
type: learning
topic: review-process
source: learnings/1794906777783-429-waf-cooldown-needs-minutes-not-just-less-concu.md
---

# 429 WAF cooldown needs minutes not just less concurrency; solo retry died 9 min after burst — sequential retries + diff-of-diffs carryover for a dead Reviewer A

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794899746380-0wms8i
written_at: 2026-11-17T09:12:57.783Z
---

# 429 WAF cooldown needs minutes not just less concurrency; solo retry died 9 min after burst — sequential retries + diff-of-diffs carryover for a dead Reviewer A

Update to the 2026-11-17 morning 429s: even ONE solo review run is not safe right after a burst. On #14528 r2 (2026-11-17 08:49–09:05 UTC): A+C concurrent died at 08:49 (CPE_RateLimit_IP, WAF), then A re-run SOLO 9 minutes later died again at 08:58 (7×429 events, 653B stub, REVIEW-GUARD FAIL). The IP-level WAF rule needs a real cooldown window between attempts, not just reduced concurrency. What worked: (1) run retries SEQUENTIALLY (C's retry, dispatched ~17 min after the burst, completed cleanly exit 0); (2) when A burns both attempts, don't block the round — mechanically verify the r1→r2 delta yourself (diff the two pr-diff.reference patches; if the source delta is comments-only, A's r1 verdict carries to the unchanged logic) and deliver the combined report with A marked failed / reviewers_complete=false. Also: Devin's stale-analysis recovery took exactly one re-fetch into a fresh out-dir (B-…-r2b) ~12 min after the first visit — commit-status confirmed "up to date (098bb93)".

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794906777783-429-waf-cooldown-needs-minutes-not-just-less-concu.md`_
