---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786709677734-cyi17g
written_at: 2026-08-19T20:03:07.544Z
---

# [approver] "rebase vs merge" is a commit-GRAPH claim — verify with commits/&lt;sha&gt;.parents, not inferred from "head moved + PR files unchanged"; and a review's framing/🔴s can shift across a base-update while the code is byte-identical

## Context
slang#12347 got a second `synchronize`. Head advanced c5c6ab243080 → 37809f6e9028. I confirmed all
13 PR file blobs were byte-identical (per-file sha256) and gap #4 (missing per-test try/catch at
`slang-internals-test-main.cpp:168`) was unaddressed — correct and load-bearing. But I labeled the
base-update a "PURE REBASE." DECISION_REVIEW critique overturned that: `37809f6e` is a MERGE commit
("Merge branch 'master' into <branch>", parents 672e3713 + 3e85d4c2), and c5c6ab24 is an ancestor
(`compare` ahead_by 23, behind_by 0). Master-into-branch merge, not a rebase.

## Lesson 1 — "rebase" is a claim about the commit graph I did not open
"Head moved but the PR's files are unchanged" is consistent with BOTH a rebase AND a
master-into-branch merge; it does not distinguish them. The distinguishing evidence is the parent
structure: `gh api repos/O/N/commits/<sha> --jq '.parents'` (two parents + a "Merge branch" subject
⇒ merge; one parent ⇒ rebase/fast-forward), plus `compare/<old>...<new>` (`ahead_by`/`behind_by`,
`status`). This is the same class as my standing rule "every error is a claim about a state I did
not open" — a merge-vs-rebase word is a graph state, so open the graph. It did not change the
decision here, but shipping an unverified graph characterization into audit artifacts is the exact
habit that produces a wrong decision elsewhere.

## Lesson 2 — a base-update can flip the bot review's framing while the code is byte-identical
Between the two revisions (identical PR blobs, same diff_hash 7d09eebf0a4c) the production
github-actions[bot] review re-ran and consolidated DIFFERENTLY: R1 "🟡 0 bugs / 5 gaps" (incl. the
runner try/catch) → R2 "🟡 Minor — 1 gap (design doc not in README index) + 2 clarity", NOT
re-flagging the try/catch. And Devin, which timed out on R1, completed on R2 (exit 0) and asserted
2 🔴 — BOTH of which failed verification as correctness bugs (main.cpp:185 skipped-count-omitted =
reporting nit, Ignored≠passed and exit keys on failedTestCount; main.cpp:21 "<cstdio>/<cstring>
forbidden" = unsupported, both headers have repo precedent).
Takeaways: (a) **review non-determinism does not resolve an unchanged code property** — a gap the
review stops mentioning is not a gap that went away; re-derive from the code. (b) **A review's 🔴
label is a claim, not proof** — verify each against source before it can BLOCK. (c) On a
`synchronize` where the base moved, re-check whether the PR's own blobs actually changed
(per-file sha256) before assuming the diff is new work.
