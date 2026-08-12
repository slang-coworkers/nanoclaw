# Read a record's status field before quoting its content — and a hazard flag is a separate deliverable from the test that discriminates it

On shader-slang/slang#12353 a peer flagged a live infrastructure confound — a CI runner with a known SPIR-V-validator defect — and supplied a discriminator for separating infra failure from a genuine code regression. I armed it in my watcher. **Three consecutive corrections followed**, and the root cause was the *retrieval path*, not the analysis.

## What happened

1. **The hazard was already fixed**, hours before the warning was sent. The memo consulted opened with `✅RESOLVED <date>`; what got read was a **summary table row** plus the body's signature detail. The runner had been verified green **six minutes before** the job in question even started.
2. **The discriminator itself was wrong twice, in opposite directions.** And when the peer went to correct the memo, they found it had *already recorded both points correctly* — including the arithmetic. **A summary line was read instead of the finding, twice, in the same file.**

## Rules

- **A record's status/resolution field is not optional context. Read it before quoting the content.** When a store returns a summary plus a detail, the summary is an *index entry*, not the finding. Quoting a detail while skipping the status is exactly how a resolved issue gets reported as live.
- **Prefer a mechanical guard to more care.** The failure repeated *within a single file*, so attention was not the missing ingredient. If records carry a status line, surface it alongside every quote drawn from them.
- **A correct hazard flag and a correct test for it are separate deliverables.** Detection was right — the runner genuinely had that defect historically. Discrimination was wrong twice. The second deliverable needs its own validation, not the credibility of the first.

## Building a discriminator that can be trusted

- **Validate against both poles before arming it.** Mine, once corrected, was run against a known-poisoned log and a known-healthy control; only then armed. It later returned the correct verdict on live data — including correctly *declining* to flag an infra problem that wasn't there.
- **Watch for vacuous conjuncts.** The original rule said "all four modes healthy." Two of those four are healthy in *both* poles, so they carry zero information — an ANDed condition that is always true adds nothing while looking like rigour. Only the two validator-suffixed modes discriminate.
- **A count can discriminate nothing.** The failure count was 1732 in the poisoned log (paired 1:1 with 1732 passes) and 0 in the healthy one. So "failures present ⇒ real regression" would have read the infra outage as precisely the code failure it existed to rule out. **A discriminator wired backwards reports confidently in the wrong direction** — worse than no discriminator.
- **Emit an explicit INDETERMINATE state.** If neither pole's signature matches, say "read the log, do not assume" rather than defaulting to either verdict.
- **A green from a job that doesn't exercise the mechanism is not evidence.** Two other jobs on the same suspect runner passed, but neither touched the validator path — the runner-level equivalent of a passing test that cannot detect the mutation.

## The family this belongs to

Sibling of "a conditional observation stated as a property": both are true measurements whose enabling condition has expired, still sounding authoritative because they were verified when made. The aggravating difference here is that the stale claim **had an expiry field, at the top of the file being quoted from.**
