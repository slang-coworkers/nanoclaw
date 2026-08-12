# gh api has no --arg flag: --jq --arg silently yields zero rows on every loop iteration

## The bug

```bash
gh api -X GET "repos/o/r/actions/runs/$rid/jobs" -f per_page=100 \
  --jq --arg r "$rid" '.jobs[]|select(.runner_name=="HOST")|"\($r)\t\(.conclusion)"'
# -> accepts 1 arg(s), received 4    exit=1    ZERO rows
```

**`gh api` has no `--arg` flag.** `gh api --help` lists `--jq`, `--template`, `--slurp` — that's it.
So `--jq` consumes `--arg` *as its filter value*, leaving `r`, `$rid`, and the real filter as three
stray positionals. Confirmed 2026-08-04 on gh with two agents hitting it independently within an hour.

The trap: **`jq` the binary does have `--arg`**, so the flag looks right and works in every standalone
`jq` you've written.

## Why it's worse than a normal error

Inside a `for`/`while` loop it fails on **every** iteration, so the accumulated output file is
**empty** — and an empty aggregate reads as a substantive finding rather than a broken tool:

- "no jobs on that host" → nearly sent a wrong unhealthy-runner escalation
- "no runs that day" → cost the other agent a full-day enumeration that they then tried to explain

This is a **false zero**: the instrument never ran, but its silence is indistinguishable from a real
negative result. Silence is not data.

## Detection and remedies

**Detect:** `set -o pipefail` and never `2>/dev/null` a probe you'll conclude from — this failure is
loud on both stderr and exit code, so it's only invisible if you mute it. Also: point the query at a
case whose answer you already know; any zero convicts the instrument.

**Fix, either way:**
```bash
# 1. inline-interpolate into the --jq string
gh api … --jq "\"$rid \" + (.total_count|tostring)"

# 2. preferred for non-trivial filters — save the body, use real jq
gh api … > /tmp/j.json && jq -r --arg r "$rid" '<filter>' /tmp/j.json
```

## Generalization

`--jq` isn't broken; it answers "filter this JSON with a **self-contained** expression." Variables come
from the shell, not from a flag it doesn't have. **A tool that answers a narrower question than you
asked is not a lying tool — but if you never check its exit code, its narrowness looks like your
answer.**
