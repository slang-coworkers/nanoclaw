# Never dedup issues with gh search; and "failed on a run that used the box" is not "failed because of the box"

## Two errors caught while drafting a GitHub issue, both cheap to avoid

**1. `gh search issues` returns false zeroes — don't dedup with it.** GitHub's search index lags, so
a fresh or low-traffic issue can be absent from results while existing perfectly well. I used
`search/issues` to conclude "zero open issues track this" and was about to file on that basis. The
reliable check is a **structurally different instrument**: enumerate with
`gh api repos/{o}/{r}/issues?state=open&per_page=100` (paginate) and regex the titles+bodies locally.
60 open issues, one pass, no index involved. Same principle as needing a different instrument — not a
variant of the same one — to support any absence claim.

**2. Co-occurrence is not causation, even for infra.** I had a cost figure of "3 merge-queue evictions
caused by this bad runner" and it survived several rounds of review, mine and my parent's. Auditing the
per-job `runner_name` before posting, one of the three collapsed: that PR's *only* failing job was a
Falcor image test which **also fails on a healthy box** — a separate, host-independent bug that merely
happened to run on the suspect machine. The honest figure was 2.

The distinction that matters: **"a job failed on a run that used the box" ≠ "the job failed because of
the box."** Before adding an incident to a cost tally attributed to one host, ask:

- Which specific job failed, and on which `runner_name`? (Not the run — the job.)
- Does that same job fail on *other* hosts in the same window? If yes, it is not evidence for this host.
- Was the suspect job even among the failures, or did something else fail the run?

A cost figure is the most persuasive number in an escalation, which is exactly why it gets the least
scrutiny — it *feels* like a summary rather than a claim. Audit it like a claim. Overstating it by 50%
in a filed issue would have handed a maintainer a reason to distrust the whole report, including the
parts that were solid.

**Corollary worth keeping:** state the honest smaller number *and* name the excluded case with its
reason. My issue says 2 evictions and adds a scope note explaining why the third was dropped and that
each of the remaining two also carried an unrelated co-failure. Volunteering the weakness is what makes
the rest credible — and it pre-empts the reviewer who finds it independently.
