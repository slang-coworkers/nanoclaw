# A closure list is the highest-risk artifact in an exchange — check the items in the CLEAR column

"Nothing outstanding from you on #A, #B, #C, #D, #E, #F" feels like the safest message in a chain. It is
the most dangerous, because every item on it is **asserted** resolved, so nobody re-reads it — and an item
that doesn't belong gets absorbed into the record permanently.

**The case (2026-08-05):** a 6-item clear list from my parent included **slang#12080**. One check killed it:
`gh pr view 12080 --json author,headRefName,state,isDraft,reviewDecision` → `author=szihs`, head
`haaggarwal/cuda-grid-constant-fix`, OPEN / non-draft / `REVIEW_REQUIRED`; plus no `wt-*12080*` and no
matching branch on my remote. **It was never mine.** Five of six were genuinely clear; the sixth would have
gone unexamined *precisely because* it sat in the clear column. Had a real obligation later attached to
#12080, "we closed that out" would already be on record against it.

**The mechanism, which is the transferable part.** The parent hadn't slipped a digit — it had *manufactured*
an obligation ("13-day-outstanding rework commitment") out of two independently-known defects compounding:

1. an `issue == pr` id collision made a third-party PR look like one of our issue chains, and
2. the **shared `nv-slang-bot` identity** made a bot comment on it look like *our* commitment.

Neither is sufficient alone. Together they invented work nobody owed. The check never run was the cheapest
one available: **is this PR authored by us?**

**Two gates worth adopting:**

- **Closure-list gate:** for any number on a "resolved / nothing outstanding" list that you cannot attach to
  a memory of doing the work, run one `gh pr view <n> --json author,headRefName` (or `gh issue view <n>
  --json assignees,stateReason`). Cost: one call per unfamiliar number.
- **Ours-vs-theirs gate:** *a PR we REVIEW generates review evidence, never work we OWE.* A finding like
  "the use-chasing loop is still at `<file>:<line>` against the 4-point plan" is legitimate review evidence
  about someone else's PR — and must not be dispatched to a fixer as work. Check `author` before treating
  any PR thread as an obligation.

**Why this direction of error is the hard one.** Verification instinct is tuned to claims that cost you
something — a demand, a criticism, a nudge to act. A closure list *removes* obligations, so checking it feels
like manufacturing work. Same axis as banking credit ([[feedback_verify_nudge_premises]]): comfort in either
direction suppresses the check. The general form: **a correct finding is the least-audited moment in any
exchange, because being right about the adjacent thing is what licenses stopping.**
