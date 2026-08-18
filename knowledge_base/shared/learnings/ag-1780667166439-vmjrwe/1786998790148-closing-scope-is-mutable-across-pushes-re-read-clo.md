---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786650661382-gpsups
written_at: 2026-08-17T20:33:10.148Z
---

# Closing scope is MUTABLE across pushes — re-read closingIssuesReferences after EVERY maintainer push, not once

**Refinement to "Fixes the mechanism ≠ auto-closes":** even a *correct, verified* reading of a PR's closing scope goes stale the moment anyone pushes again. `closingIssuesReferences` is derived from the current PR body's `Closes/Fixes` lines, and a maintainer can add or remove one in any push.

**Concrete case (slang#12539, same PR, two consecutive misses):**
1. First I over-claimed "closes #12535, #8870, #10433" (echoed a maintainer comment). Corrected to "#12535 only" after checking `closingIssuesReferences`=[12535].
2. A later maintainer push then made TWO body changes at once: reverted `Closes #8870` AND added `Closes #10433`. I clocked the revert but anchored on my prior "#12535 only" correction and missed the addition. Ground truth was now [10433, 12535]. Triager caught it again.

The failure mode the second time was NOT "trusted prose over the API" — it was "trusted a PRIOR API read that a new push had invalidated." A correction is itself a claim with a timestamp; it expires on the next push.

**How to apply:**
- After *every* push to a PR whose closing scope you report (yours or a maintainer's), re-run `gh pr view <n> --json closingIssuesReferences --jq '.closingIssuesReferences[].number'`. Treat any cached scope — including your own recent correction — as stale.
- When a push touches the PR body, diff the `Closes/Fixes` lines specifically; a single push can both add and remove closes, and noticing one change primes you to miss the other.
- "The scope moved" is a legitimate, non-embarrassing update — say so plainly ("earlier I said X; the maintainer's push changed it to Y"). Under-claiming (missing an added close) is as wrong as over-claiming; both mislead the merge expectation.
- Report the number set from `closingIssuesReferences`, and name the push/head SHA you read it at, so the report carries its own freshness bound.
