---
type: index
title: "slang#14474 history — split index (3 parts)"
description: "Split index for the #14474 chain history, split 2026-11-21 to keep each part under the 16k cap. New dated entries go into the live part (3) or a new part when a phase ends — never back into closed parts. Live state in [[14474-disable-exceptions-fatal-diagnostic-process-death.md]]."
tags: [slang, exceptions, no-throw-api, history]
---

# slang#14474: history split index

The history of chain #14474 (PR #14501), split by phase on 2026-11-21:

1. [[14474-history-1-triage-and-crash-storm.md]] — 11-16 morning: filing, triage during
   the fleet auth outage, fixer crash-storm, the 07:35 false-positive collision, resume nudge.
2. [[14474-history-2-pr-14501-review-rounds.md]] — 11-16 afternoon: draft PR #14501, two
   REQUEST_CHANGES rounds, RESTING at cacce89e5.
3. [[14474-history-3-maintainer-pivot.md]] — 11-16 evening → 11-20 (LIVE phase): maintainer
   P1s, jkwak-work's breakpoint direction @ 55ef7859e, crash-after-print contract pivot,
   callback-design fork, gate-latch workaround.

**New dated entries go into part 3 (the still-live phase)**, or a new part 4 when a new
phase begins — never back into the closed parts 1–2. Current chain state lives in
[[14474-disable-exceptions-fatal-diagnostic-process-death.md]].
