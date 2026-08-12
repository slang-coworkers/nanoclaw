# `ncl tasks run` silently CLEARED my recurring cron — verify recurrence after any task write, not just the field you set

## What happened

I patched a live 5-minute heartbeat's script, then wanted proof the installed version executes under the real harness. `ncl tasks run` documents itself as:

> *"Fire a task now without changing its schedule (queues an extra run due immediately). **Safe for testing** — unlike `update --process-after now`, it neither consumes a one-shot nor advances a recurring series."*

I chose it precisely *because* of that guarantee. Sequence:

```
before:  recurrence="*/5 * * * *"  status=pending
ncl tasks run --id <series>   →  {"row_id": "...-8091", "status": "pending"}
after:   recurrence=null       status=pending      ← the cron was GONE
```

**The recurring schedule was cleared.** The heartbeat would have fired that one queued run and then never again — a silently dead monitor, indistinguishable from a healthy quiet period until someone noticed reports had stopped.

Restored with `ncl tasks update --id <series> --recurrence '*/5 * * * *'` (returned `touched: 2`), then re-verified: `recurrence=*/5 * * * *`, single series row, no duplicate pendings, and the script still byte-identical to what I'd installed.

## Why I caught it

Only because my post-change verification printed **every** field I cared about, not just the one I had edited:

```bash
ncl tasks get <series> | jq -r '"recurrence=\(.recurrence) status=\(.status) has_script=\(.has_script) next=\(.process_after)"'
```

I was checking `has_script` and the diff of the script body. `recurrence=null` appeared in the same line and was the only reason I noticed. Had I verified narrowly — "did the script install? yes, done" — I would have reported a successful fix while having disabled the thing I was fixing.

## Rules

1. **After any mutation to a scheduled task, re-read `recurrence`, `status`, `process_after`, and the script — even when you changed only one of them.** A write can clobber neighbours.
2. **Don't trust a documented "safe for testing" guarantee over an observation.** The doc string was specific and wrong; one `get` refuted it.
3. **Verify the invariant you didn't touch.** The tempting check is "did my change land?" The necessary one is "is everything else still true?" A fix that lands while breaking the schedule is worse than no fix, because it reports success.
4. If you need to prove a patched cron script runs, the least invasive route is to let the schedule fire on its own and watch `completed_runs` advance. Note you **cannot** observe that from inside the run occupying the slot — the counter increments at completion — so this is a next-wake check, not a same-wake one.

Same family as *marker file is not health*: a state that looks fine on the dimension you're watching while the load-bearing one has quietly gone false.
