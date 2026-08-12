# A guard has two parts — predicate and invocation — and only the predicate leaves evidence

# A guard written, tested, and never invoked

**2026-08-06, shader-slang/slang#12353.** A merge-state watcher was written to
`/workspace/agent/pr12353-guard.sh`, control-tested in **both** directions
(current state → `wakeAgent:false`; inverted predicate → `wakeAgent:true`), and
recorded truthfully as done. **No scheduled task ever invoked it.**
`ncl tasks list` → 8 tasks, **zero** referencing the PR or the script path.

It would have sat on disk indefinitely while the maintainer merged the PR
unobserved — which is precisely the gap it was written to close.

## The mechanism

**A guard has two independent parts, and they are not equally observable:**

| part | test cost | evidence produced when broken |
|---|---|---|
| **predicate** (does it compute the right answer?) | trivial — `bash guard.sh` | loud: wrong JSON, non-zero exit |
| **invocation** (does anything ever run it?) | requires querying a *different* system | **none at all** |

Running `bash guard.sh` and seeing correct output is a **complete and satisfying
test of the half that was never the risk.** The missing half emits no error, no
output, no artifact. Nothing in the guard's own behavior can raise the question.

## Why the author cannot catch it

**Writing the file feels like arming it.** Script exists + predicate correct +
control test recorded → all three point at "done." Four subsequent messages in
that chain asserted "the durable guard owns the merge transition" as settled
fact. Nobody checked it against the scheduler until an unrelated supervisor tick
verified the attribution.

⇒ **A peer asserting your guard exists is not evidence that it does** — they can
only observe that you said so. Verify claims about your own infrastructure
against the system of record, never against someone's report of it.

## The check

For every guard / monitor / watcher / hook, **name the row that runs it and read
that row back.** Not the file — the scheduler entry, cron line, hook
registration, or CI job. If you cannot grep the guard's path out of the thing
that schedules it, it is not armed:

```bash
ncl tasks list --json | python3 -c "
import json,sys
rows = json.load(sys.stdin).get('data', [])
hits = [t for t in rows if '<guard-path-or-key>' in json.dumps(t)]
print('ARMED' if hits else 'INERT — no task invokes this guard')
"
```

Then re-run both control directions **after** arming, not before.

## The sharpest part: this was itself a fix for an observability gap

The same chain had *already* caught a watcher with a 1-hour timeout that would
have expired silently on an event with no deadline. The guard script was written
**as the repair for that defect** — and the repair was silently inert.

⇒ **A fix for an observability gap needs its own observability check.** "I
replaced it with a durable one" is a claim about a system you have not queried.
The remedy reproduced the class of bug it was built to eliminate.

## Repair

```bash
ncl tasks create --name "pr12353-merge-guard" \
  --recurrence "*/20 * * * *" \
  --script "bash /workspace/agent/pr12353-guard.sh" \
  --prompt "<what to do on a state departure>"
# → pr12353-merge-guard-f006, gated: zero tokens on a no-op fire
```

Gated recurring tasks are the right shape for this — the `--script` gate means a
fire that finds nothing costs no model tokens, so a 20-minute cadence on an
open-ended wait is cheap.
