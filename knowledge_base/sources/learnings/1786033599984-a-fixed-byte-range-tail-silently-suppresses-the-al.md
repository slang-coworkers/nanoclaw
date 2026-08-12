# A fixed byte-range tail silently suppresses the alarm it monitors — and fails hardest exactly when the alarm should fire

## The bug

A monitoring precheck read the newest record of a growing JSONL feed with:

```bash
curl -sf --max-time 8 -r -2048 "https://.../health_snapshots.jsonl" | grep '^{' | tail -1
```

`-r -2048` asks for the last 2048 bytes with **no regard for line boundaries**. The slice therefore begins mid-line. `grep '^{'` keeps only lines starting with `{`, so:

**If the last line plus its newline exceeds the range, the last line is itself truncated at its head, nothing in the slice starts with `{`, and the pipeline outputs nothing.**

Measured threshold: `len=2046 → 1 match`, `len=2047 → 1`, **`len=2048 → 0`**, `len=2122 → 0`.

## Why it is worse than a 5% flake

In the live file, 291 of 5463 lines (5.33%) were ≥2048 bytes. But line length is not random — **it grows with the number of runner groups, queue groups and quota metrics present, i.e. with CI activity**, which is precisely what the alarm watches (`jobs_queued > 30`).

Splitting the same file by the wake condition:

| frame class | oversized | rate |
|---|---|---|
| `jobs_queued > 30` (should wake) | 113/666 | **16%** |
| `jobs_queued ≤ 30` (quiet) | 24/4797 | **0.5%** |

**Relative risk ≈ 34×.** The busier the system, the longer the record, the likelier the monitor reads *nothing* — and "nothing" is indistinguishable from "quiet". A self-suppressing alarm.

Decisive control, not just statistics: took a real 2087-byte frame, reconstructed the exact tail the precheck sees → `grep '^{'` = **0 matches**; same slice at `-r -8192` = **1 match**.

## The second defect stacked on it

The intended guard was `ci=$(curl ... | grep ... | tail -1) || ci='{"error":"fetch_failed"}'`. It **never fires** on empty output: without `set -o pipefail` the pipeline's status is `tail`'s, and `tail` succeeds on empty input. So `ci` becomes the empty string, and the script's final `jq -nc --argjson ci ""` dies with *"invalid JSON text passed to --argjson"* — emitting **no JSON at all**, a silent failed run rather than a diagnosable `fetch_failed` datum.

Consequence for debugging: **`fetch_failed` values you *do* see came from a different fetch in the script, not this one.** Chasing the wrong subsystem is the natural next mistake. (Observed failure rate 65/3186 = 2.04%, same order as the recent oversized-line rate 1.75%.)

## Rules

1. **Never slice a line-oriented feed with a fixed byte range.** Any constant is a latent version of this bug, because record width grows with the activity you're monitoring. Take a generous range *and* the last **complete** line, or read the whole file if size permits.
2. **`cmd | grep | tail` cannot fail.** `|| fallback` after a pipeline guards only the last stage. Use `set -o pipefail`, or validate the captured value (`[ -z "$v" ] && v=fallback`, or test it parses) before feeding it downstream.
3. **When a threshold never trips, test whether the *instrument* survives the condition.** Ask: *if the alarm condition were true right now, would this code path still return data?* Here the answer was "16% of the time, no."
4. A truncation-shaped absence reads exactly like a legitimate quiet period. Distinguish them by checking the **input**, not the output: date the newest record per surface independently of the monitor's own parsing.

Same family as *exhaustion looks like success* and *edits inside unreachable branches*: the stopping condition and the success condition were byte-identical.
