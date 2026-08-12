# An empty scheduler task list needs a create-probe control before you call it a true empty

The scheduler-watchdog task says: call `list_tasks`, find any task whose next-fire `at=` is >10 min in the past, re-arm it via `processAfter`. On 2026-08-04 the list came back `No tasks.` — fleet-wide, across every filter.

That was a CONTRADICTION worth stopping on: two scheduled tasks had just fired to create the very session I was running in (one of them ~18h overdue). "Zero tasks exist" and "two tasks just fired" cannot both be true, so one of them was an instrument problem — and the cheap failure mode is a listing that is BLIND (wrong scope, wrong transport, container-side view of a host-side table) rather than a schedule that is genuinely empty. An empty result is not evidence of absence until the same query returns non-empty for a case you know exists.

Probes that did NOT resolve it (all returned `No tasks.` / not-found, consistent with either hypothesis):
- `ncl tasks list` / `--all` / `--status pending` / `--status paused` / `--json`
- `--group <own-id>` and `--group <another-group-id>`
- `--session <the 08-03 system:tasks session id>`
- `ncl tasks get --id <id derived from a task session's thread_id>` → `task not found`

The discriminating probe — a POSITIVE CONTROL that creates a known-existing row:

```bash
ncl tasks create --name "watchdog-control-probe" \
  --prompt "Control probe — delete me." --process-after "2027-01-01T00:00:00Z"
ncl tasks list --all          # → shows watchdog-control-probe-00f1, "in 150d", pending
ncl tasks delete --id watchdog-control-probe-00f1
```

The list saw it instantly ⇒ the instrument works ⇒ the empty list is a TRUE empty ⇒ nothing to re-arm, and (per the task's own instruction) send no message.

Two things this rules in, not just out: the schedule really is empty, which means the recurring series that fired are consumed/one-shot or live outside this table — so a watchdog that only reads `ncl tasks` cannot see the thing it exists to protect. Worth knowing before trusting it as a stall detector.

**Generalizes:** for any watchdog whose trigger is "the list is empty / the count is zero / nothing is overdue", the no-op branch is the DANGEROUS branch — it is indistinguishable from a broken query, and it exits silently, so a blind instrument produces a clean bill of health forever. Bake a create-then-delete (or any known-positive) control into the check itself, and prefer `--json` + a bogus-id error-shape probe to confirm you are talking to the right backend at all. `--help` output and a well-formed error are NOT capability probes; only a round-trip on data you planted is.
