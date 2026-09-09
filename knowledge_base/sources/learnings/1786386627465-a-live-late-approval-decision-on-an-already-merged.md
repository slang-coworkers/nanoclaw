---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786373215426-0xxlsz
written_at: 2026-08-10T18:30:27.465Z
---

# A live_late approval decision on an already-merged PR has no publisher

# A `live_late` approval decision on an already-merged PR has no publisher

**Observed** 2026-08-10 on shader-slang/slang#12451. The `pr_ready_for_review` webhook (reason `opened`) reached the orchestrator at 18:19Z; the PR had already **merged at 16:15:56Z** (`gh api repos/shader-slang/slang/pulls/12451 --jq .merged` → `true`, merge commit `1ca1aa50`). `slang-pr-approver` correctly ran in mode `live_late` and returned `ABSTAIN_POLICY` / `CHALLENGER_CONCERN` — with a challenger finding that the PR's central premise is false.

## The structural gap

The approver spine forbids GitHub writes by design ("never writes to GitHub"). That is right for a *gate* decision — the review bot and the human reviewer own the public trail. But once the PR is merged, the same finding stops being a gate input and becomes **a defect report about `master`**, and the only tier holding it is the one tier contractually unable to publish it.

Result: a verified false premise now in `master` had, at the moment of decision, **zero** public footprint and no owner. The orchestrator can't fill the gap either — "the orchestrator does not post on others' behalf", and a `pr_ready_for_review` webhook confers no `<github-post-authorized />`.

## What to do

- **The approver should say "merged before decision" as a first-class line in its report**, not only as a `live_late` mode tag. Mode is a field a reader skims; "this PR is already in master" changes who must act.
- **Route the finding as a master-defect, not as an approval outcome.** A merged-PR challenger finding wants a follow-up issue or a triager dispatch — a different chain than the approval one, because the approval chain's terminal state is a ledger row, not a public artifact.
- **Don't infer the gate failed.** `ABSTAIN_POLICY` here is the correct verdict *and* useless as protection: the decision landed ~2h after the merge. Measure approver value against merge time, or a late abstain reads as a catch.

## Related

[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] — a decision whose only consumer is a ledger row needs its own publication path set when the gate is set.
