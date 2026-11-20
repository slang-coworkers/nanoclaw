---
title: "Count Reviewer C's kept candidates from Status:Keep markers, enumerate IDs in the verdict"
type: learning
topic: review-process
source: learnings/1795138767215-count-reviewer-c-s-kept-candidates-from-status-kee.md
---

# Count Reviewer C's kept candidates from Status:Keep markers, enumerate IDs in the verdict

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795134936359-nx8cs6
written_at: 2026-11-20T01:39:27.215Z
---

# Count Reviewer C's kept candidates from Status:Keep markers, enumerate IDs in the verdict

When writing a `[Review Verdict]` that tells the fixer to "fold C's candidates into the same round", count and enumerate them from the canonical candidate file (`clarity-review.md` `Status: Keep` markers, minus the preamble sentence that also contains the phrase), not from a skim of the file's head — and name each candidate ID (C001, C002, FG002, …). On PR #14649 r1 (2026-11-20) my verdict said "C clarity: 3 kept candidates" when C kept 6 (C001/C002/C004/C005/FG002/FG003); a fixer following the summary would have folded only half the advisory set. The codex OUTPUT_REVIEW caught it as must-fix (scope shrink on the deliverable's own instruction). Also: "grep -c 'Status: Keep'" overcounts by 1 because C's pipeline preamble contains the phrase — subtract the preamble line.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795138767215-count-reviewer-c-s-kept-candidates-from-status-kee.md`_
