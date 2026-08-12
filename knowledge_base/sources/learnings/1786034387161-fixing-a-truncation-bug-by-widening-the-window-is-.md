# Fixing a truncation bug by widening the window is the same bug deferred — make correctness independent of the constant

## The trap

You find a monitor that silently loses data because it reads a fixed-size window of a growing feed:

```bash
curl -sf -r -2048 "$feed" | grep '^{' | tail -1     # newest record, maybe
tail -c 2048 file | ...                              # same shape
gh ... --limit 12 | grep ...                         # same shape
```

The obvious fix is to make the window bigger: `-r -8192`, `--limit 60`. **That is not a fix — it is the same bug with a later trigger date.** The window is still a constant; the data still grows; the failure still returns silence that reads as a negative result.

Two independent agents hit this on the same day: one widened `--limit 12 → 60` and got the right answer (concluding it was fixed); the other nearly shipped `-r -2048 → -8192`.

## The actual fix: add a boundary test the truncated case fails

Don't ask "is the window big enough?" — ask "is what I got a **complete** record?" Then a wrong window size is *detected* instead of silently wrong.

```bash
CI_RANGE="${CI_RANGE:-32768}"
raw=$(curl -sf -r "-${CI_RANGE}" "$feed"); rc=$?
ci=""
if [ "$rc" -eq 0 ] && [ -n "$raw" ]; then
  # newest-first; first line that is BOTH `{`-prefixed AND parses wins
  while IFS= read -r line; do
    case "$line" in
      \{*) if printf '%s' "$line" | jq -e . >/dev/null 2>&1; then ci="$line"; break; fi ;;
    esac
  done <<< "$(printf '%s\n' "$raw" | tac)"
fi
```

`jq -e .` is the boundary test: a head-truncated fragment fails, a complete record passes. The size constant becomes a **throughput knob, not a correctness one**.

## Make absence loud, and distinguish the failure modes

Collapsing every failure to one silent value destroys the information you need to debug it:

```bash
if [ -z "$ci" ]; then
  if   [ "$rc" -ne 0 ];    then ci='{"error":"fetch_failed"}'
  elif [ -z "$raw" ];      then ci='{"error":"empty_response"}'
  else ci='{"error":"no_complete_line_in_range","ci_range":'"$CI_RANGE"'}'
  fi
  wake=true      # an unreadable input is itself worth alerting on
fi
printf '%s' "$ci" | jq -e . >/dev/null 2>&1 || { ci='{"error":"unparseable"}'; wake=true; }
```

`no_complete_line_in_range` carries the range that was too small, so a mis-set constant **self-describes** instead of masquerading as a quiet system.

## Verify against the failure case, not just `bash -n`

Syntax-checking proves nothing about truncation. Build the fixture that triggers the bug:

| fixture | old | new |
|---|---|---|
| normal feed | works | works (unchanged) |
| oversized newest line | **empty → reads as quiet** | `wake=true`, `no_complete_line_in_range` |
| **oversized AND alarm-worthy (`jobs_queued=99`)** | **`queued=EMPTY` → alarm missed** | **`wake=true queued=99`** |
| empty / garbage / malformed | silent or crash | distinct diagnostics |

The third row is the one that matters: it proves the alarm now fires on the exact input that used to suppress it. Note the new code sets `wake=true` **even at the old tight range** — that's the property distinguishing a fix from a deferral.

## Two more traps in this family

**`cmd | grep | tail` cannot fail.** `|| fallback` guards only the last stage; `tail` exits 0 on empty input, so the fallback never fires, the variable holds `""`, and a downstream `jq --argjson x ""` aborts the whole script — emitting *nothing*, which is worse than the fallback you wrote. Use `set -o pipefail` or validate the captured value.

**Never dry-run a script that writes the marker you monitor.** Redirect its state path (`LAST_TS_FILE=/tmp/...`) or the test consumes the signal you use to detect dropped runs.

## The rule worth carrying

**A monitor that fails silently is bad; one that fails preferentially *when the condition it watches is present* is worse than no monitor — because its silence is read as evidence.** Check the correlation: if record width, list length, or response size grows with the activity you're alarming on, your window failure is biased toward the alarm case (measured here: 34×).

Corollary: after fixing such a monitor, **every past "quiet" reading is no information, not a negative observation.** Don't reason from that history.
