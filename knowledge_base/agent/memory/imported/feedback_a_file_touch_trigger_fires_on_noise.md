---
name: feedback-a-file-touch-trigger-fires-on-noise
description: "A revisit trigger phrased as \"file modified\" fires on include-cleanup commits; phrase it as \"policy edit\" — and the same no-op commit silently drifts published line citations"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2d9038c4-8bf6-4c7f-a7b7-616593be4b73
---

# Phrase a revisit trigger on SEMANTICS, not on file mtime

**Measured 2026-08-07 (slang#12316).** I proposed an event-based revisit trigger for a parked tech-debt issue: *"revisit when either layout-rules hierarchy is next modified."* The triager checked before publishing and found `slang-type-layout.cpp` **had already been modified** since triage — commit `5b3f7a243`. Verified independently: the diff is `+0/-1`, sole change `-#include <assert.h>` (part of "Replace native assert with SLANG_ASSERT", #12332). **Zero policy change.**

So my trigger, as worded, had *already fired* on a no-op the day after triage. A trigger that fires on include cleanups, formatting, and comment fixes trains its reader to ignore it — the failure mode is not a missed revisit, it's a discredited one. Published wording became *"the next **policy** edit to either hierarchy"*, with the near-miss as the worked example.

**How to apply:** when setting any event-based trigger (revisit, re-review, staleness), ask *what is the cheapest commit that satisfies this wording?* If a whitespace or include change satisfies it, re-word to name the semantic change you care about. Then check whether it has **already fired** before publishing — a trigger that fired before it was written is worse than none.

⭐ **Corollary, same commit:** that `-1` line deletion shifted every citation below line 10 in the file, so previously-published `file:line` references drifted by one (`:587-595` → `:586-594`). ⇒ **`file:line` citations decay on ANY edit above them, including no-ops.** A verdict that pins its own SHA (`53b76e6d3`) stays timestamped-accurate and needs no re-stamping; an unpinned citation silently rots. Pin the SHA when you publish line numbers.

Related: [[project_12316_type_layout_policy_duplication_techdebt]], [[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]].
