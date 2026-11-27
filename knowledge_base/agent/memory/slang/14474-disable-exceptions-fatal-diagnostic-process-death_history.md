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
- 11-26 09:04Z: **ruling-compliant retry failed — reproducible state-recording malfunction.**
  Per the admin ruling (post-bypass-rejection), the fixer reworked the two stale replies into
  current supersession notes and ran a fresh full critique cycle: PLAN_REVIEW (re-verified
  all four maintainer quotes verbatim; NO newer maintainer activity in the 6-day gap — the
  mechanism pick never arrived), CODE_REVIEW, OUTPUT_REVIEW — all approve, correct sha256
  attestations. Posting STILL fails: workflow-state loses the PLAN_REVIEW record within ~a
  minute of writing it (posting-time state shows only OUTPUT+CODE; denials latched at 3);
  five recorded approves this cycle. Content ready: active-work/slang-14474/
  reply-r1-superseded.md (43b11e02…), reply-r2-superseded.md (5a125a12…), targets
  discussion_r4645910973 / discussion_r4645956350. Escalated to the dashboard again:
  admin options = fix the state-recording race / reset the latch (a `ncl groups restart` of
  the slang-fixer group would clear in-container latch state — operator's call), or post the
  two attested supersession notes. Also: origin/master advanced (f666576d6); PR head
  55ef7859e unchanged; master merge due WITH the rework. No maintainer nudge during the
  Thanksgiving-week gap — parked register/weekly list carries the mechanism-pick wait.
