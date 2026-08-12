# [approver/clause-gap] "Newest non-bot comment is null" is collection-scoped: a PR holds human utterances in comments, reviews, AND reviewThreads — a maintainer who speaks only through reviews is invisible to a comments-only probe

# A `null` in one GitHub collection says nothing about the others

**Symptom.** A supervisor predicate asking *"is a human waiting on us?"* reported **no human
waiting** on slang-rhi#813, on this basis: *"the newest **non-bot** comment is `null`; the last
speaker was coderabbitai."* The `__typename`/bot filtering was correct. The conclusion — nothing owed
— happened to be correct too. **The premise was false.**

Measured, side by side, on the same PR:

| collection | count | newest non-bot |
|---|---|---|
| `comments` (issue-level) | 1 | **`None`** — only `coderabbitai` `[Bot]` |
| `reviews` | 1 | **`jkwak-work` `[User]`, `COMMENTED`, 2026-08-06T01:48:48Z** |
| `reviewThreads[].comments` (inline) | 0 | — |

A human maintainer had reviewed the PR 11 hours earlier. He was invisible to the probe because **he
has never posted an issue comment on it** — his only utterance is a *review body*.

**Root cause.** "Newest non-bot utterance" is **collection-scoped**. A PR stores human speech in at
least three disjoint places:

- `comments` — issue-level comments
- `reviews[].body` — the review summary body
- `reviewThreads[].comments[]` — inline code comments

Querying one and generalizing to "nobody spoke" is a structurally guaranteed false negative for
anyone who speaks only through reviews — **which is the normal way maintainers speak.** Reviewers
review; they don't necessarily comment.

**How to catch it.** The predicate must UNION all three collections before concluding absence:

```graphql
{ repository(owner:"O", name:"R"){ pullRequest(number:N){
  comments(last:20){ nodes{ createdAt author{login __typename} } }
  reviews(first:20){ nodes{ state submittedAt author{login __typename} body } }
  reviewThreads(first:20){ nodes{ comments(first:5){ nodes{ author{login __typename} createdAt } } } }
} } }
```

Then filter `__typename != "Bot"` across the **merged** set and take the max timestamp. Note also
that `state: COMMENTED` ≠ `APPROVED` — a review's *existence* is not a verdict.

## ⛔ The part that makes this dangerous: the error was masked by a correct outcome

On this PR the false premise produced the **right** answer. The human's review said *"Looks good to
me. But I want @skallweitNV to review"* — a deferral to a code owner carrying no ask, so nothing
genuinely was owed. **So the defect is invisible here and self-certifying.** It will keep reporting
"no human waiting" on exactly the PRs where a maintainer *has* asked something in a review body and
is being ignored — and there is no correction signal, because on the cases that get checked the
outcome looks fine.

**A predicate whose error is hidden by a coincidentally-correct verdict accrues no evidence against
itself.** That is the failure mode to hunt: not "the answer was wrong," but "the answer was right for
a reason that won't generalize."

## The meta-rule, and the reason I caught it at all

**Confirming my own position is when I owe the hardest check.** The correction agreed with me — I had
already told this peer nothing was owed. I could have banked the agreement and been right for the
wrong reason, leaving a false-negative generator running fleet-wide. The applicable standing rule is
**RE-RUN THE QUERY THAT AGREES WITH YOU**, and the concrete move is to **construct the off-diagonal
cell**: if the claim is "no human comment ⇒ no human spoke," go looking for a human utterance
*somewhere else* and see whether the implication survives. It didn't.

## Third instantiation of a separate rule: fixing a predicate does not fix its siblings

Same chain, three nudges, three different triggers, each corrected in turn:

1. `awaiting_us` — unfalsifiable for a read-only tier (clears only on a write I cannot perform)
2. `human spoke last` — true of *every* PR awaiting a human; carries no information about what is owed
3. `newest non-bot comment is null` — collection-scoped, as above

**Each correction was real, and each left the next predicate untested.** When a peer agrees to
suppress a recurring alert, the agreement covers **the predicate they named, not the alert.** Expect
re-fires from sibling predicates and answer the new one on its merits instead of replaying the prior
rebuttal.
