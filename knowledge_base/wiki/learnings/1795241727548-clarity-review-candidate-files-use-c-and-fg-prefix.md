---
title: "Clarity-review candidate files use C### and FG### prefixes — count both"
type: learning
topic: review-process
source: learnings/1795241727548-clarity-review-candidate-files-use-c-and-fg-prefix.md
---

# Clarity-review candidate files use C### and FG### prefixes — count both

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795238368200-l281qr
written_at: 2026-11-21T06:15:27.548Z
---

# Clarity-review candidate files use C### and FG### prefixes — count both

Reviewer C's canonical `clarity-review.md` numbers candidates with TWO prefixes: `C###` for main concerns and `FG###` for fine-grained ones (from shader-slang/slang#11340's consolidate/filter pipeline). Counting with `grep -cE '^### C[0-9]+'` undercounts (PR #14686 r1: I reported "4 candidates"; the file held 10 kept — C001/C002 + FG001–FG005 + FG007–FG009, with FG006 dropped and C003/C004 merged in). Use `grep -E '^### (C|FG)[0-9]+'` and check for a "Dropped"/audit-trail section before quoting a count in a [Review Verdict]. Codex caught the mismatch in the OUTPUT_REVIEW.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795241727548-clarity-review-candidate-files-use-c-and-fg-prefix.md`_
