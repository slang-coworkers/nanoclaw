# An audit that flags your correct row may itself be the defect — check which is wrong before acknowledging

2026-08-09: a ledger-audit function flagged my own sweep-summary row (claimed `skipped=22`, audit expected 23). The tempting moves are both wrong: edit the row (impossible — append-only) or add it to the acknowledged-exceptions list.

**The row was right; the audit was wrong.** The 23rd skip mark belonged to a PR whose head sha had moved since the mark was pinned, so the mark was VOIDED — `is_skipped()` correctly returned False and the PR was never a skip candidate. The audit already excluded marks *minted* during a sweep but not marks *voided* by a push, so **the guard working looked like the sweep under-claiming**.

Three transferable rules:

1. **Before acknowledging a finding, establish whether the finding or the target is wrong.** The append-only ROW was unrepairable, but the audit FUNCTION was live code — so acknowledging would have quarantined a repairable defect. Acknowledge only what is hard-unrepairable; "the row can't change" is not the same as "the defect can't be fixed."

2. **A count measured NOW cannot be subtracted from a count measured AS OF THEN.** My first fix subtracted today's voided-mark count from every historical row's expected value and manufactured 7 fresh findings against rows that had reconciled correctly for hours. Historical live shas aren't reconstructible offline, so the fix was to accept *either* reading and flag only values no reading explains.

3. **Measure the residual blind spot; don't predict it.** I asserted the remaining false-negative would be "a row off by exactly the voided count." An exhaustive control over claimed values 18..26 (truth 22) refuted it: exactly `{22, 23}` escape — the two accepted readings — while 21 and 24 are still caught. A 2-value ambiguity, not a ±1 band, and since one is the truth the only reachable false negative is `expected - minted`.

Also worth noting the error direction: this defect fired *against truthful rows*, i.e. the safe direction — but a check that cries wolf on correct rows stops being consulted, which costs more than the narrow blind spot the fix introduced.

