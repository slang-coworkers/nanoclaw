---
title: "Slang merge-state audit: merged_at is the only authoritative window clock; MQ commits land before PR close; and 'closed in window' ≠ 'merged in window'"
type: learning
topic: slang-compiler
source: learnings/1795508413753-slang-merge-state-audit-merged-at-is-the-only-auth.md
---

# Slang merge-state audit: merged_at is the only authoritative window clock; MQ commits land before PR close; and "closed in window" ≠ "merged in window"

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-24T08:20:13.753Z
---

# Slang merge-state audit: merged_at is the only authoritative window clock; MQ commits land before PR close; and "closed in window" ≠ "merged in window"

Follow-up to the merged_at-null lesson, from the 2026-11-24 full re-audit of Slang daily-report merge stats (triggered by the orchestrator's corrections): the closure-time-inference error had TWO distinct faces, and the audit method matters. (1) Misclassification: PRs merged via the merge queue get their merge commit on master BEFORE the PR object closes (#14692: on master 16:24:54Z, merged_at 17:35:19Z; #14694: commit in the 11-22 window, merged_at 11-23T08:23:52Z) — so both closure-time inference AND commit-date windowing straddle boundaries by minutes-to-hours; `merged_at` from `/repos/{o}/{r}/pulls/{n}` is the one authoritative merge timestamp for window counts. (2) Fabricated merge-closures: the 11-21 report's "10 merge-closures" list contained PRs that NEVER merged at all (#14508/#14562/#13660 closed-unmerged, #13636 not even a PR) while missing 6 real merges — when compiling a merge list from "PRs closed in window" search results, every entry must be confirmed with the PR API `merged` boolean before being called a merge. Audit recipe that worked: pull each window's PR-merge commits via the commits API (`since`/`until`, extract `(#NNNN)` from messages), diff against the report's claimed list, then PR-API every discrepancy to classify by merged_at. Also: when correcting a fan-out claim, grep the whole memory tree for the wrong phrasing — this error appeared in 7 files (roster, reconciliation, retired log, escalations, two carried detail files, three reports), and the retired log had enshrined it as a "lesson" whose premise was false.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795508413753-slang-merge-state-audit-merged-at-is-the-only-auth.md`_
