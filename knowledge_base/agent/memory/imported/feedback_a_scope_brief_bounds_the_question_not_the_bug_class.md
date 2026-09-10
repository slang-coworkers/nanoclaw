---
name: feedback_a_scope_brief_bounds_the_question_not_the_bug_class
description: "A tight scope brief bounds the QUESTION, never the bug class. Scoped triage to 'confirm these 2 facts about the bug'; nobody asked whether the FIX had the same class of bug. It did — a 🔴 unresolved 7 commits old that defeated the fix's own guarantee. Census unresolved review threads before ranking pre-merge priorities."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9119cce4-1876-4df9-a20f-8481b119a65b
---

**Measured 2026-08-06, shader-slang/slang#12376 / PR #12354.** I dispatched triage with a deliberately
tight brief: *"verify-and-route, not diagnose — confirm my two 'will mislead you' facts at source, then
go to the unowned follow-up-carrier question."* The scoping was correct and triage executed it well
(both facts confirmed at source, three repro rows reproduced with md5 bracketing controls, one of my
own overstatements caught and dropped).

**Neither of us asked whether the *fix* contained an instance of the same bug class.** It did.

Review thread `3717966165` on #12354 — filed by the review bot 08-05 04:35Z — was `isResolved=false`,
`isOutdated=false` **23 hours and 7 commits later**: an in-band-sentinel collision that lets one
crafted offset bypass the validating walk entirely. The PR exists to establish "every location a
consumer can reach lies inside the blob"; that guarantee was defeated inside the change that
establishes it. Strictly more consequential than the carrier question the brief was scoped to — and
triage's published comment led with the carrier question until I caught it.

⇒ ⭐⭐⭐ **A scope brief bounds the QUESTION. It does not license ignoring a 🔴 on the artifact under
discussion.** "Out of scope" is a statement about effort allocation, not about what is true. When the
scoped answer and an unscoped 🔴 sit in the same PR, the 🔴 leads.

## The check, and the flag pair that matters

Before ranking pre-merge priorities on any fix PR, census its **unresolved** review threads:

```bash
gh api graphql -f query='
{ repository(owner:"<o>", name:"<r>") { pullRequest(number:<n>) {
  reviewThreads(first:50) { nodes {
    isResolved isOutdated
    comments(first:1){ nodes{ databaseId author{login} path body } } } } } } }' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[]
        | select(.isResolved==false and .isOutdated==false)
        | "\(.comments.nodes[0].databaseId) \(.comments.nodes[0].path) :: \(.comments.nodes[0].body|split("\n")[0][0:90])"'
```

⭐ **`isResolved=false` alone is not the signal — you need the pair.** `isOutdated=false` is what says
the thread still points at *current* code. An unresolved-but-outdated thread may already be moot; an
unresolved-and-not-outdated thread on a 7-commit-old PR is a live finding nobody answered. 9 of 13
threads were open here.

## Companion finding: resolution erases a concern, so a resolved thread is not a record

Same PR, measured: thread `3717967835` ("the validator ships with no test") is **resolved**, and the
identical concern came back as two *fresh* threads (`3721950188`, `3724613121`). The default-flip gap
did the same (`3717966999` resolved → `3721948450`, `3724612029`).

⇒ ⭐⭐ **A concern that must be re-discovered to persist is not recorded.** This turns "a review comment
the merge resolves away" from a prediction into an observation — the erasure already happened twice,
and both concerns survived only because a bot re-found them. Use this when arguing that a follow-up
needs its own issue: don't predict the loss, show the instance.

## Sub-rule: model the arithmetic instead of reasoning about the algebra

The bot's original write-up described the collision as reachable when a pointer "lands exactly one byte
before the blob" — which reads like a corner case. Triage, asked to re-derive rather than relay,
confirmed `FossilInt = int32_t` / `BlobOffset = Int64` and then **evaluated** raw `-1 - D` at
D = 0, 4, 12, 28, 32, 160, 3840, 7227, 2³¹-2: every one yields exactly `-1`, with both controls firing
(genuine nulls still map to the sentinel; ordinary forward pointers do not collide). ⇒ available at
**any** offset, not a corner case. **Modelling upgraded the severity that algebraic description had
understated.** When a defect's reachability is described qualitatively, plug in numbers.

Related: [[feedback_a_negative_control_must_vary_exactly_one_thing]],
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]],
[[project_12376_fossil_oob_relative_ptr]].
