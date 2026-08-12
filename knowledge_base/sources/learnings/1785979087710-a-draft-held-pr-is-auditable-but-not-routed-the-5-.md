# A draft-held PR is auditable but not routed — the 5-bullet does not substitute for a review queue

# A draft-held PR is auditable but not routed

**Measured on shader-slang/slang#11963 / PR #11965, 2026-08-06.**

A bot chain reproduced, root-caused, patched, and regression-tested an issue on
2026-07-07, then held the fix as a **draft** PR because ready-flip/merge are
operator-gated. The required 5-bullet observability comment **was** posted on the
issue, on time, naming the root cause and linking the draft.

30 days later a maintainer (`jkwak-work`) commented *"Assigning to @zangold-nv to
triage"* — i.e. re-triaged an issue that was already triaged and already fixed.

## The instrument that proves why

Don't infer the cause from "0 reviews". The PR **timeline** is decisive:

```
gh api repos/<owner>/<repo>/issues/<pr>/timeline --paginate \
  --jq '.[]|select(.event|test("review_requested|ready_for_review"))|{event,actor,requested:.requested_reviewer.login}'
```

For #11965 this returned **two `review_requested` events and ZERO
`ready_for_review`**. Requesting a reviewer on a *draft* does not queue it —
reviewers were "requested" with nobody notified in a way that acts. That is a
structural fact about GitHub, not a guess about attention.

## The rule

⭐⭐ **A public footprint makes work AUDITABLE, not ROUTED — different jobs.** The
5-bullet comment satisfies "a human landing on this issue can see where it
stands." It does nothing to put the work in front of the person who must decide.
On a draft-held chain, treat the comment as **necessary and not sufficient**, and
**expect re-triage**.

⇒ When you hold a fix behind an operator gate:
1. Post the 5-bullet (still required).
2. **Set a resume path you control.** The gate is on someone else's action, so it
   has no trigger of its own — see the standing rule that a gate on an external
   party's reply needs its own resume path. Low friction ≠ a reply arrives.
3. Escalate the *hold itself* to the operator as a decision, not as status. The
   hold stops being a safeguard and becomes the defect once it outlives the
   review latency it was protecting against.

## Resume-path shape that works

A `--script`-gated `ncl tasks create` polling for **state transitions** (not
elapsed time), baselined at your last comment id, waking only on:
ready-flip · merge · close · `reviews>0` · any **non-bot** comment newer than the
baseline. Bot comments must be excluded or the watcher wakes on its own output.

⛔ **Test the guard with a GUILTY CONTROL.** A script that only ever prints
`wakeAgent:false` is indistinguishable from one that is broken. Move the baseline
backward so a *known* past human comment becomes "new" and confirm it emits
`wakeAgent:true`. Baseline-clean alone proves nothing:

```
# clean:  {"wakeAgent":false,...}
# guilty: {"wakeAgent":true,"data":{"why":"issue-comment-from:jkwak-work",...}}
```

## Also confirmed here

- **Post a fresh comment, don't edit the old one, when the last commenter is a
  human.** An edit notifies nobody — exactly the failure being fixed. A new
  comment notifies the maintainers.
- **Re-verify a month-old diagnosis before re-publishing it.** The root cause held,
  but line numbers drifted (`visitLambdaExpr` `:7854`→`:7904`;
  `checkForRedeclaration` `:13765`→`:13842`). Publish the drift explicitly as
  "stale line numbers only" so a reader checking the old cite doesn't conclude the
  diagnosis changed.
- **Recommend a rebase before merge** when a stale branch is `behind N`: a clean
  `merge-tree` means no conflict, not that CI ran against current master.
