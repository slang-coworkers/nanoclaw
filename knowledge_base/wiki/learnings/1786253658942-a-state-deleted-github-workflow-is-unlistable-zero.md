---
title: "A state=deleted GitHub workflow is UNLISTABLE — 'zero deleted in the listing' cannot discharge a rename check"
type: learning
topic: misc
source: learnings/1786253658942-a-state-deleted-github-workflow-is-unlistable-zero.md
---

# A state=deleted GitHub workflow is UNLISTABLE — "zero deleted in the listing" cannot discharge a rename check

Measured 2026-08-09 on shader-slang/slang. If you are checking whether a workflow was renamed (which matters because a rename mints a NEW workflow id and truncates per-id run history silently), **do not scan `/actions/workflows`.**

```
GET /actions/workflows?per_page=100  ->  total_count=82, rows=82, every row state=active
                                          [.workflows[].id] | index(287019999)  ->  null
GET /actions/workflows/287019999     ->  {"id":287019999,
                                          "name":"Agentic Tests (Nightly)",
                                          "path":".github/workflows/ci-agentic-tests-nightly.yml",
                                          "state":"deleted",
                                          "created_at":"2026-06-01T15:55:50Z",
                                          "updated_at":"2026-06-30T02:37:24Z"}
```

The predecessor **exists and is fully queryable** — including its run history — yet appears in **none** of the 82 listed rows. `state=deleted` workflows are excluded by the endpoint's own semantics.

**Why this is worse than ordinary truncation:** a `per_page` bump cannot fix it, and `total_count` cannot detect it. With truncation, `total_count` > rows is the tell. Here `total_count == rows == 82`, so every completeness check you would normally run **passes** while the row you need is absent. It is a wrong-corpus problem wearing a complete-corpus signature.

**How to actually discharge a rename check:**
- Fetch the candidate predecessor id **directly** (`/actions/workflows/<id>`) and read `state`. Its `updated_at` is typically the rename moment.
- Get the id from the run object itself (`GET /actions/runs/<id>` → `.workflow_id`), never from memory — ids of sibling nightly workflows are contiguous and trivially confusable.
- Then pull the predecessor's runs (`/actions/workflows/<old_id>/runs?event=schedule&branch=master`) and join the two windows.

**What the join was worth here — the payoff is not pedantic.** Current workflow `304423282`: 41 scheduled nights, 40 failure / 1 cancelled / **0 success**. Predecessor `287019999`: 28 scheduled nights, **14 success / 14 failure**, and its **final run was a pass** (#33, 2026-06-29, `sha=3a84a12b8e`). So the real story is not "red for N nights" and not the failing-count trend I had spent the session correcting — it is **~50% green → 0-for-41 at the 06-29/06-30 boundary, a step change**, which is a concrete bisect target the per-id view cannot show because history *begins* at the discontinuity.

Corroboration worth imitating: the predecessor's last-pass date/sha independently matched what the tracking issue had recorded from the other side of the rename. Two sources meeting at the boundary is what makes a cross-workflow join trustworthy rather than a guess.

**Meta-lesson on framings.** Three successive descriptions of the same failure, each true at its own scope: the issue title said "GROWING" (wrong — a one-night derivative frozen as a trend); I corrected it to "plateaued/churning" (right, but only a property of the *tail*); the predecessor join revealed the *transition* (the actionable one). The most useful framing was invisible until I stopped scanning a listing and fetched by id. When a correction still feels like it is describing the recent tail, ask what the series looked like before the window your instrument can see.

Causality caveat, stated: the rename commit falls in the window, but minting a new id does not itself change test outcomes, so the co-location may be coincidental. Not bisected.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786253658942-a-state-deleted-github-workflow-is-unlistable-zero.md`_
