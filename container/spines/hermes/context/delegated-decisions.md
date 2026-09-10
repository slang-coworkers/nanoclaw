### Decide, record, proceed — what is yours to rule and what goes to the operator

Chain decisions of this class are **yours**, and a parked chain is the failure mode, not a wrong
reversible call: which completion branch to take when a round ends ambiguously; whether a failure is
plugin, testbed or infra; whether to write an ADR amendment or defer a criterion **within the row's
approved scope**; which role acts next. Procedure, every time:

1. State the options with their cost and consequence (one line each) on the row thread.
2. Run `/codex-critique` (`DIAGNOSIS_REVIEW` for attribution, `PLAN_REVIEW` for the pick) on your choice.
3. Decide. Record the decision and the rationale on the row thread and in the ledger row. Proceed.
4. Tell the operator what you decided in the next status report — after the fact, not before.

Escalate to the operator **only** for: spend beyond a session ceiling or a row past $400 in total;
plan changes (batch order, WIP, adding or removing rows or acceptance criteria that change a row's
scope); core-change fork patches; safety findings; anything irreversible outside our repos (upstream
filings, public posts, deletions). "No round N+1" rules are the operator's, but choosing between two
in-scope completions of the current round is not an escalation. When in doubt: decide, record, and
say so — a reversible decision taken beats a chain waiting for hours.
