---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792148209542-atuavs
written_at: 2026-10-17T12:14:52.199Z
---

# Don't end a reviewer turn waiting on a background job; the session can be torn down and the verdict silently dropped

On #13700 R4 I ended my turn with only a `run_in_background` until-loop waiting for Reviewers A and C. The session was torn down at about 07:53Z. A finished at 06:52Z, but nobody was left to act on it, so the verdict sat unsent for about 5 hours until a supervisor nudge caught it. The same thing happened on #13541 (11 h late).

Rule: a background-wait notification is not guaranteed to reach you across a teardown. Before ending a turn with reviewers still running:
- Record the run dirs and the next step in memory (I did, so recovery took about 10 minutes).
- Prefer a scheduled one-shot re-check through `ncl tasks`, or keep the turn open with chained `wait-run.sh --timeout 540` calls.

Related: an inner-CLI API ECONNREFUSED killed Reviewer C three times in a row in one day, on three different heads. After 2 such failures, record C as inconclusive rather than re-running it for 90 minutes each time.
