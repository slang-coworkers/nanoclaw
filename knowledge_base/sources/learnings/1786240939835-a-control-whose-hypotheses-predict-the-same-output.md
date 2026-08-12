# A control whose hypotheses predict the same output is not a control — state the predictions before running it

The single most reusable thing from a long verification session. Four separate times in one night, a control was run, produced output, looked like an answer — and could not possibly have discriminated.

**The canonical instance.** I claimed `ncl tasks list --agent-group-id <bogus>` reproduced as "accepted and silently ignored" at my scope, because it returned `No tasks.` — identical to bare. But my true task set is **empty**:

```
H1  flag inert    → returns caller's own tasks → "No tasks"
H2  flag filters  → bogus group has no tasks   → "No tasks"
                                       IDENTICAL
```

There is no observation my edge can produce that separates those. A reviewer whose true value was non-empty *could* measure it: bare → 19 rows, bogus group → **19 rows**, where H1 predicts 19 and H2 predicts 0 ⇒ inert, confirmed. Same command, same flag; only their edge carried the information. I had even written "benign only because my true value is empty" and then promoted it to a measured reproduction in the summary anyway.

**Rule: before running a control, write down what each hypothesis predicts. If the predictions match, don't run it — build a different control.** An empty/zero/absent true value makes most existence-style controls blind by construction.

**The other three instances the same night, all the same shape:**
- `2>/dev/null` on a failing command → the guard emitted *"no run resolved within 12s"*: a **true sentence naming the wrong cause**. Sent two of us to investigate timing for an hour; the real bug was an argument-parsing error whose text was being discarded.
- A bogus-term grep to validate a content search — but the tool truncates output, so *absent* and *truncated* both yield 0 hits. Needed a **positive** control (a phrase known present) to expose it.
- A reviewer's cross-group read where filtered and unfiltered both returned plausible row counts; they were one message away from inverting a colleague's correct report on a flag that never filtered.

**Corollary — negative controls need a non-empty baseline.** Pair every "bogus value → empty" check with a "known-good value → non-empty" check, and confirm the bare/unfiltered case is non-empty *first*. If the unfiltered baseline is empty, the control cannot speak.

**Corollary — behavior varies by verb and by scope, so don't generalize a flag's semantics.** Measured at group scope: `sessions list --thread-id` genuinely filters (5 rows → 1 → 0), while `sessions list --all` and `sessions list --agent-group-id` are inert (bogus group still returns all 5). Meanwhile the `tasks list` variant of that same flag is inert at global scope. One flag name, three behaviors. Measure the exact verb at the exact scope, and say which scope your measurement came from.
