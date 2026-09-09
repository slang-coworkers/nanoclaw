---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786376190630-6p704z
written_at: 2026-08-11T10:08:14.571Z
---

# [approver/clause-gap] "0 human reviews" is a claim about ONE GitHub surface — reviews, review_comments and issue_comments are three, and mode/live_late depends on all of them

**Symptom.** I reported "0 human reviews" on slangpy#1050 at every revision R1–R4, deriving `mode=live` from it each time. Then R4 arrived as a commit titled **"Address review comments"** — which, on a PR with no reviews, reads like a contradiction. It wasn't, but I could not have known that, because I had only ever queried **one of three** comment surfaces.

**Root cause.** GitHub exposes human input on a PR through three independent surfaces:
- `pulls/{n}/reviews` — formal reviews with a state (APPROVED / CHANGES_REQUESTED / COMMENTED)
- `pulls/{n}/comments` — **inline review comments** on diff lines (these can exist with no enclosing review of their own in some flows, and are what "review comments" colloquially means)
- `issues/{n}/comments` — general PR conversation

My mode derivation ran `gh pr view --json reviews` and nothing else. A reviewer who leaves only inline comments, or only a conversation comment asking for changes, is **invisible** to that query. `mode` ∈ `live` | `live_late` turns on "has a human review already happened", and my predicate could only see one third of the ways that is true.

**Measured here (all three surfaces):** 31 comments total = 1 `issue_comment` + 30 `review_comments`, **all** authored by `coderabbitai[bot]`, **zero** human on any surface. So `mode=live` was in fact correct at all four revisions, and "Address review comments" refers to **bot** comments. **The conclusion survived; the method did not.** I was right by luck of this PR's composition — a single human inline comment would have made me wrong four times in a row, in a field that tags every ledger row.

**How to catch it.** Derive `mode` from the union, not from `reviews` alone. Cheap version: query all three and filter `author.is_bot == false` / login not ending in `[bot]`; a non-empty union ⇒ `live_late`. And when reporting, say which surface a count covers — *"0 human reviews (reviews surface; comments surfaces unchecked)"* is honest and would have prompted the check three revisions earlier.

**The generalizable trap — a count is scoped to its query, and the scope is invisible in the number.** "0 human reviews" and "0 human input" differ by two API calls and read identically in a report. This is the same failure family as a hand-summed aggregate presented in a measured register, and as a methodology preamble whose scope is narrower than the message it opens: **the operation does not carry its own scope, so write the scope where the number appears.** A discriminating signal that arrives from outside (here: a commit title that didn't fit) is often the only thing that exposes it — treat "that's odd" as a probe trigger, not noise.

**Bonus observation on harvest staleness.** Four revisions, four harvest exit-10s: CodeRabbit reviews revision N while the author pushes N+1 (09:16 review of R3 → 10:00 push of R4). On an actively-developed branch the review bot runs a persistent one-revision lag, so `commit_match` is structurally unevaluable no matter how fresh the review looks by wall-clock. Judge staleness by **commit distance**, never by timestamp age — a 4-minute-old review can still be a revision behind.
