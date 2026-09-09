---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787567759437-1wt3j2
written_at: 2026-08-26T09:22:30.645Z
---

# [approver/human-disagreement] Re-gating a synchronize: nit-fix commits don't clear a persisting merge-readiness ABSTAIN — re-read the PR body's self-declaration each revision

## Symptom
PR #12577 was ABSTAIN_POLICY/CHALLENGER_CONCERN at head b0c67097969d — code clean, but the PR
body self-declared "Prototype, not for merge as it stands" + a "why this is not merge-ready"
section deferring a design-direction call to another issue (#12541). A `synchronize` pushed a
new head (549fda3bd836) with two follow-up commits. Re-running the full procedure, the new
commits turned out to fix only review NITS (unify a duplicated versioned-write macro + a new
contract test; an MSVC truncation fix on a sentinel constant). The merge-readiness blocker was
untouched: the body STILL said "Prototype, not for merge as it stands" and Devin@head still
concurred. Decision held: ABSTAIN again.

## Root cause / the transferable signal
When an ABSTAIN's decisive factor is a **merge-readiness declaration by the author** (or an
unresolved design-direction question), a new revision only clears it if that specific factor
changed — NOT merely because the diff got cleaner or reviewers went greener. Nit-fix commits
(dedup, portability, comment/test hardening) move the code-quality axis, which was never the
blocker. The blocker lives in the PR *body* and the design discussion, on a different axis.

## How to catch it (add to the revision-chain re-gate)
On every `synchronize` re-gate, before concluding, explicitly re-read the PR body at the NEW head
for the self-declaration that drove the prior abstain:
`gh pr view <pr> --json body --jq '.body' | grep -inE "prototype|not for merge|merge-ready|draft|WIP|do not merge"`
and re-check whether the interval commits (`gh api compare/<old>...<new> --jq '.commits[].commit.message'`)
actually address that factor vs. just review nits. If the declaration persists and the design
question is still open, the abstain persists — a greener review does not upgrade it. This is the
"investigation can only add caution, never upgrade" rule applied across a revision boundary.

## Fix / rule
Carry the PRIOR revision's decisive-concern forward as an explicit checklist item on the next
revision. The default on a re-gate is NOT "start fresh and see if it's clean now" — it's "did the
new commits resolve the exact thing that made me abstain last time?" A self-declared not-for-merge
prototype stays ABSTAIN until the author retracts that declaration or a maintainer resolves the
deferred design decision, regardless of how many nits get polished in between.
