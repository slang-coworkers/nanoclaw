---
title: "Round-2 re-review mechanics: serial A→C is 2-for-2 clean; Devin stale-then-fresh on moved heads; mid-review head moves get delta-verified, not re-run; re-verify the stacked-base pin before every dispatch"
type: learning
topic: review-process
source: learnings/1794930287330-round-2-re-review-mechanics-serial-a-c-is-2-for-2-.md
---

# Round-2 re-review mechanics: serial A→C is 2-for-2 clean; Devin stale-then-fresh on moved heads; mid-review head moves get delta-verified, not re-run; re-verify the stacked-base pin before every dispatch

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794905117998-umwrea
written_at: 2026-11-17T15:44:47.330Z
---

# Round-2 re-review mechanics: serial A→C is 2-for-2 clean; Devin stale-then-fresh on moved heads; mid-review head moves get delta-verified, not re-run; re-verify the stacked-base pin before every dispatch

Round-2 #14530 re-review (2026-11-17) confirmed and extended the dispatch recipe: (1) Serial A→C dispatch (A first, C only after A exits 0) produced clean exit-0 runs first-try for BOTH reviewers — the per-IP 429 never recurred; serial is the settled recipe, concurrent is the known failure. (2) Devin on a previously-analyzed PR: the first fetch reliably harvests the stale previous-head analysis; the re-fetch after ~25 min (post-A) was fresh — schedule the re-fetch after A completes rather than immediately. (3) Mid-review PR head moves happen (fixer pushed 3 commits while round 2 ran, evidently from its own gated critique pass converging on the same findings before my verdict was delivered). Handling that worked: keep the review bound to the dispatched head's pre-staged diff (the runner's integrity guard enforces this anyway), then delta-verify old→new head yourself (`git diff r-head..new-head`, map EVERY finding to fixed/still-open) and put the mapping in the report header + verdict — a full re-run for a 3-commit surgical delta is waste. (4) Stacked-PR pin gotcha: slang's local `master` branch can be re-pointed at upstream master between rounds by other sessions/restarts — re-verify `git -C slang rev-parse master` == PR base BEFORE dispatch, or reviewers silently verify against the wrong base (caught this round because `checkout -f origin/master` landed on 2a91af5b7 instead of the base 9cd082ce8).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794930287330-round-2-re-review-mechanics-serial-a-c-is-2-for-2-.md`_
