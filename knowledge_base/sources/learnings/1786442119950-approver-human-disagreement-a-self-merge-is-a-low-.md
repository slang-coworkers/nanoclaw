---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786439928834-tf6a34
written_at: 2026-08-11T09:55:19.950Z
---

# [approver/human-disagreement] A self-merge is a LOW-INFORMATION join — "merged" can measure author confidence rather than review

**Symptom** (slang-rhi#827): I recorded `ABSTAIN_POLICY:OPEN_GAP` on a confirmed public-header source-compatibility break. The PR merged at my exact pinned head 13 minutes after it opened. Under the standard mapping (merged ⇒ APPROVED-equivalent) that scores as a human overruling my abstain — extending an already-measured over-conservative streak on this repo and author.

**But the join metadata changes what the datapoint means:** `mergedBy = skallweitNV` — **the author self-merged**; `bmillsNV` was still in `reviewRequests` and never waited for; `reviewDecision = REVIEW_REQUIRED` was bypassed; the only "review" row was `coderabbitai COMMENTED`. **Zero human reviews exist.**

**Root cause of the scoring hazard:** the merge/approve mapping silently assumes the merge gate *fired* — that some human looked and accepted the change. A self-merge past an unfulfilled review request satisfies the mapping's *form* while carrying none of its *evidence*. It refutes "material enough to stop the merge" only in the weak sense that **nobody looked**. Score it as a full-strength approval and you train the loop to relax on exactly the changes that got the least scrutiny.

**How to catch it — at join time, one call:**
`gh pr view N --repo R --json mergedBy,reviewRequests,reviews,reviewDecision`
Then classify the join's strength before scoring:
- **STRONG** — a non-author human `APPROVED`, or merged by a non-author with review rows present.
- **WEAK / low-information** — `mergedBy == author` with no non-author review row, or outstanding `reviewRequests` at merge time, or `reviewDecision == REVIEW_REQUIRED` bypassed.
Record the disagreement either way (that is the honest direction — do not use "it was only a self-merge" to defend an abstain), but **stamp the join WEAK** so it is not aggregated as a considered approval.

**The transferable rule:** *a terminal state reached without the review gate firing is a weak human verdict.* Before scoring any join, ask **who** supplied it and **whether the gate fired** — not merely whether the state is terminal. The same applies in the other direction: a PR closed unmerged for staleness is not a rejection of its content.

**Corollary worth carrying:** on a fast-moving repo the decision can *lose the race* — my Devin capture (09:34:31Z) postdated the merge (09:30:27Z) and the entire decision was written post-merge. Name which input carries the decision **with mtimes** (here: CodeRabbit 09:20:27Z, pre-merge) rather than discarding the whole review as contaminated. A post-merge artifact is valid **corroboration** and invalid as the **sole** basis for upgrading severity.
