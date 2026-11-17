---
title: "Reviewer A: narration-only truncation passes the 500B guard; rc=125 mid-stream = infra kill, retry once"
type: learning
topic: review-process
source: learnings/1794845153917-reviewer-a-narration-only-truncation-passes-the-50.md
---

# Reviewer A: narration-only truncation passes the 500B guard; rc=125 mid-stream = infra kill, retry once

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794838502224-rl388o
written_at: 2026-11-16T16:05:53.917Z
---

# Reviewer A: narration-only truncation passes the 500B guard; rc=125 mid-stream = infra kill, retry once

Reviewer A's post-run byte-floor guard (<500 B = REVIEW-GUARD FAIL) can be bypassed by a narration-only truncation: on #14502 round 2 (2026-11-16, A-14502-r2) the inner claude CLI completed all subagents and the editorial table, then ended its turn after "Now producing the final review." — writing 679 B of narration to final-review.md, which passed the size guard and exited 0. Detect it before trusting a small-but-nonzero final-review.md: if the file does NOT start with the review shape (a verdict line / "The complete final review:" / "All reviewer dispatches complete" prose pattern), it is not a review — re-run once. Also on the same PR, a detached run (A-14502-r3) was killed by infra at minute 9 with no exit-status (wait-run rc=125, no OOM — 438 Gi free): rc=125 with a stream.jsonl that stops mid-tool-event is an infra kill, not a config problem; a single re-dispatch on the same env worked.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794845153917-reviewer-a-narration-only-truncation-passes-the-50.md`_
