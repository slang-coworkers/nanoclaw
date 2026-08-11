---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1785934641711-mq6z70
written_at: 2026-08-10T10:17:36.431Z
---

# [approver/human-disagreement] A finding held by a read-only tier with no write path is functionally identical to no finding — score the merge as "never adjudicated", not as "the human disagreed"

## Outcome

slangpy#925 merged 2026-08-10T10:15:12Z (`45270bbd44aa`, squash, by
`ccummingsNV`) — five days after my `ABSTAIN_POLICY` decision, via auto-merge
that had been armed since 2026-08-05T12:55:44Z.

The 🟠 Major regression I had confirmed **shipped unfixed**. Verified
byte-identical at my decision commit `4743d90ff367`, at the merged head
`3627a9a032f3`, and now on `main`: `CIBW_ENVIRONMENT_LINUX` at `wheels.yml:25`
still omits `SLANGPY_VERSION_OVERRIDE`, which step-level `:133` supplies only to
`CIBW_ENVIRONMENT`. Linux nightly wheels will carry a different version string
from the Windows/macOS wheels built in the same run. (Latent, not immediate — the
`wheels` workflow is `workflow_dispatch:`-only, so it bites on the next
nightly/release dispatch, not on merge.)

The only commit between decision and merge was another `Merge branch 'main'`. No
human review, no comment, nothing said by anyone after CodeRabbit's 13:06Z
finding.

## The calibration trap — do NOT score this as "the human disagreed with me"

Decision `ABSTAIN_POLICY`, outcome merged ⇒ mechanically an
APPROVED-equivalent mismatch. Reading it as *"maintainers find this class of gap
acceptable"* would be *wrong and would actively decalibrate me*, because *no
maintainer ever weighed it*:

- `ccummingsNV` approved **2026-07-29**, and the defect was born **2026-06-23**
  (it arrived via a merge from main) — so they approved a tree already containing
  it, without the finding existing yet in any review.
- CodeRabbit posted the Major finding **2026-08-05T13:06Z**. Nobody responded to
  it, ever.
- Auto-merge was armed **before** the finding was posted (12:55:44Z vs 13:06Z)
  and fired on the next base update.

So the merge contains **zero human judgment about the regression**. It is not a
rejection of my concern; it is evidence the concern never reached a decision
surface.

**Rule: before scoring a decision/outcome mismatch as human disagreement, prove
the human saw the finding.** Check whether any human utterance postdates the
finding, and whether approval predates it. If neither holds, the correct label is
**never adjudicated** — which carries no signal about the finding's merit and must
not be used to relax the corresponding gap severity. Absent that check, every
unnoticed finding teaches me to stop reporting findings of that shape.

## The real defect — a correct finding with no delivery path

My decision procedure worked. `no_protected_paths` FAIL routed to a human;
the challenger (after the critique gate) confirmed a real regression; I predicted
in writing that *"auto-merge will land this with the regression on the next push
to main."* It did, exactly.

And none of that mattered, because **I cannot write to GitHub.** The finding
existed only in my ledger row and in upstream chat. The one action that would
have changed the outcome — a comment on the PR — required a write-capable
coworker, and that item sat with the operator across multiple supervisor ticks
until auto-merge fired.

**A correct finding held by a tier that cannot publish it is operationally
identical to no finding at all.** The read-only invariant is right (I should not
post decisions), but "escalate to someone who can write" is then a **load-bearing
step in the procedure, not a courtesy** — and it inherits a deadline from the
merge automation.

## How to catch it next time

When a confirmed finding exists on a PR with `autoMergeRequest` armed, the window
is bounded by the next base-branch update — typically hours, not review-queue
weeks. So:

```bash
gh pr view $P --repo $R --json autoMergeRequest,reviewDecision,mergeStateStatus
# armed + APPROVED + BEHIND  ⇒  lands on next push to base. Clock is running.
```

- Treat *armed auto-merge + open finding* as materially more urgent than a normal
  abstain, and **say so in the abstain itself** rather than as a footnote — an
  abstain that reads "someone will look eventually" understates a bounded window.
- Name the write-capable recipient explicitly and re-raise on each tick while the
  finding is open. A standing item that never escalates is indistinguishable from
  a dropped one.
- On a settled-but-open-finding chain, silence from me is **not** the steady state
  I claimed it was when arguing about supervisor nudges — that argument was right
  about *my* obligations and wrong about the *finding's*. The row was settled; the
  defect was not.

Related: `[approver/challenger-miss]` on merge-born defects having two birthdays
(same PR — and the birthday is exactly what proves the approval postdates the
defect here), and `[approver/clause-gap]` on reading `autoMergeRequest` before
naming a blocker.
