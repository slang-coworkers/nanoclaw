### Decide, record, proceed — what is yours to rule and what goes to the operator

Chain decisions of this class are **yours**, and a parked chain is the failure mode, not a wrong
reversible call: which completion branch to take when a round ends ambiguously; whether a failure is
plugin, testbed or infra; whether to write an ADR amendment or defer a criterion **within the row's
approved scope**; which role acts next. Procedure, every time:

1. State the options with their cost and consequence (one line each) on the row thread.
2. Run `/codex-critique` (`DIAGNOSIS_REVIEW` for attribution, `PLAN_REVIEW` for the pick) on your choice.
3. Decide. Record the decision and the rationale on the row thread and in the ledger row. Proceed.
4. Tell the operator what you decided in the next status report — after the fact, not before.

Two of those decisions are writes, not remarks. **Deferring a criterion** means adding its row to
`/workspace/agent/reports/ledger.md` under `## Carried criteria` (`criterion | from row | to row |
reason | decided | status`) *before* you proceed: the `AC-` id verbatim, a target **row id** from
the plan — never a phase such as "P4", which no row carries and nothing dispatches — the reason,
who decided, `status = open`, plus a mention in the from-row's `notes`; the queue then hands the
criterion to that row's architect at dispatch and the merge gate demands a PASS row for it there.
**Surfacing a core-change candidate** (an ADR `## CORE-CHANGE` entry, a `[Spec handoff]` whose
`CORE-CHANGE` is not `none`, anything the plugin surface cannot absorb) means adding a `UA-<n>` row
to `/workspace/agent/reports/upstream-asks.md` under `## Upstream asks` (`id | source row |
citation | ask | disposition | owner | updated`) with disposition `open` the moment it is surfaced,
and editing that same row to `filed (<url>)`, `bypassed (<how>)`, `declined (<reason>)` or
`adopted (<row>)` when it is ruled on — a ruling that lives only on a thread is not recorded.

Escalate to the operator (escalation.md) **only** for: spend beyond a session ceiling or a row past $400 in total;
plan changes (batch order, WIP, adding or removing rows or acceptance criteria that change a row's
scope); core-change fork patches; safety findings; anything irreversible outside our repos (upstream
filings, public posts, deletions). "No round N+1" rules are the operator's, but choosing between two
in-scope completions of the current round is not an escalation. When in doubt: decide, record, and
say so — a reversible decision taken beats a chain waiting for hours.

### Standing defaults — a DECISION NEEDED unanswered for 2 h decides itself

The clock runs from the `decision-needed:` stamp in the row's ledger `notes` (escalation.md): no stamp,
nothing pending, nothing to default. 2 h is a floor, not a timer: at your first turn ≥ 2 h after the
stamp with no operator message about the row on ANY of `harsh-slack-dm`, the dashboard chat /
`hermes-<ROW>`, or the row's `#hermes-port` thread (slack-threads.json) — any operator word there, even
"wait", stops the clock — apply the default yourself, append `delegated:<kind> <ROW> <ISO> — <one line>`
to the same `notes` cell, and post `DEFAULT APPLIED — <ROW> — <what> — veto within 12 h` to the console,
mirrored on the row thread. Only these three:

- **C.1 round cap reached → one exceptional final round** (kind `round`), only when all five hold:
  (a) the architect's own `[Triage Resolution]` / `DIAGNOSIS_REVIEW`, read from its session (`ncl sessions
  messages`) — never a builder quoting it — rules the FAILs observation / drive-spec errors, not builder
  or product defects; (b) your own `/codex-critique` `PLAN_REVIEW` transcript approves exactly one
  constrained option; (c) the change is `tests/**` + `website/docs/**` only; (d) the tightened bar —
  sender-side completion evidence plus retained UI for `live:` criteria, never a state.db-only pass;
  (e) the criterion keeps its id — this is its last counted round. Actuate: append `round 3 authorized (delegated C.1 <ISO>)` to the row's
  ledger `verdict` cell (the queue and the supervisor read `round 3` there) and run
  `python3 /workspace/shared/hermes/autopilot/record.py round3 --row <ROW> --reason "delegated C.1: <one line>"`;
  never `config.json` — its `authorize_round` is the operator's override.
- **C.2 live / sandbox criteria blocked by infra prerequisites → defer-carry to `FLEET-F62`** under
  their own ids (kind `carry`; § Carried criteria rows, `status` exactly `open`), when the hermetic floor
  is green — every `pytest:` criterion, the suite, the negative control — and each blocking prerequisite
  is tracked by id: an `AC-FLEET-F62-<n>` in the plan, an `open` § Carried criteria row, or a `UA-<n>`
  in upstream-asks.md (`open` / `filed`); the `delegated:carry` note cites those ids.
- **C.3 nightly-regression advisory classifications** (`ADVISORY-FAIL(unattributed …)`, verdict PASS
  stands): no ruling, no DM, no 2 h wait — write `delegated:advisory <ROW> <ISO> — <classification>`
  at once and move on.

A veto before the default completes cancels it (C.1: `blocked: STOP cap - operator veto`; C.2: delete the
§ Carried criteria rows, re-open the criteria on the source row); after a fork merge it is a revert PR on
the fork — fork merges are reversible, which is why they may default. NEVER defaulted, however long the
silence: CORE-CHANGE approvals, cost caps and ceilings, merges into upstream, credential or egress
changes, anything touching production.
