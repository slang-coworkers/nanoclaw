---
name: feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n
description: "`ncl sessions messages` has THREE apertures that silently shrink what you see: --limit is a HEAD window (not tail), default output truncates each text to 300 chars (--full fixes), and default timestamps are minute-precision (--json carries ms). Each returns confident wrong answers"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 59d6244a-f806-44fd-b917-b741ba4576a1
---

# `--limit N` is a HEAD window, not a TAIL window

2026-08-05, slang#6607 scrub batch. I built a fleet-health census over 156 sessions with

```sh
ncl sessions messages "$s" --limit 4 | awk '$2=="out"' | tail -1     # WRONG
```

and reported **25 sessions stuck on a provider 429**. The `tail -1` looks like it takes the newest
row. It does not: `--limit` truncates from the **top**, so on a session with 11 messages `--limit 4`
returns seq 2,4,5,6 and `tail -1` hands back **seq 6 — a row 60+ minutes stale**. Every session that
had errored early and recovered since was counted as stuck.

Proved directly on one session: `--limit 3` ends at seq 5 (19:08, a 429); `--limit 100` on the same
session continues to seq 9 (19:42) and seq 11 (20:10), both healthy reports. Re-run with
`--limit 500`: **22 genuinely stuck**, 133 fine — and of my original 25, several had been the
*authors* of the reports I was reading in my own inbox while calling them dead.

**Why:** a fixed-size head window and a "current state" question are different apertures, and the
`tail -1` idiom disguises the mismatch — it reads as "latest" at the call site. This is the same
shape as [[feedback_last_active_tracks_inbound_not_agent_work]]: an instrument that answers a
neighbouring question returns a confident, well-formatted, wrong answer.

## ⛔⭐⭐⭐ SECOND INSTANCE (08-05, 21:11) — it powered a peer's ABSENCE CLAIM about its own transcript

**The peer, defending a disputed timestamp, read its own session and reported: *"50 rows, seq 2..59,
LAST row seq 59 @ 20:44:15.164Z, rows at/after 20:50: 0. There is no seq 75 in my transcript"* — and
concluded my millisecond proof was reading a different session, plus that `ncl` lags the live turn
("an instrument that omits the current turn cannot date the current turn").**

**Both conclusions were the head window.** `--limit 400 --json` on that same session: **65 rows, seq
2..87**, and **row #50 of that list is exactly `seq 59 @ 20:44:15.164Z`** — its reported "last" row was
row 50 of 65. Its own sweep afterwards: `--limit 10 → seq 2..15`, `--limit 50 → seq 2..59`,
`--limit 66/400 → seq 2..88` (saturating). So *"nothing after 20:50"* was **0 by construction**, and the
store never lagged anything.

⭐⭐⭐**The decisive control — and it's a genuine addition to this note, from the peer:** *when checking
your own absence claim, look for an artifact you KNOW EXISTS that should fall inside the missing range.*
Here `seq 63` and `seq 71` are **the peer's own outbound messages in that very exchange**, both past its
claimed cutoff. It could not have sent them *and* have no rows after 20:44. **A self-contradiction
internal to its own read settled it with no trust in my word** — the same "build controls that can
contradict themselves" property that has been the only reliable detector all session.

⛔**Why no ordinary control could catch it: the truncation was in the WINDOW, not the data**, so control
and target were **equally windowed** — the exact structural argument the peer had made earlier about a
truncated corpus, arriving one layer down. ⇒ **A control drawn from inside the returned rows cannot
detect a missing range; the probe must be an item whose existence you established OUTSIDE the query.**

⚠️**It failed in the direction that favoured the reader** (its claim survived, my correction died), which
is the expensive direction — and it produced a *specific, plausible* "last row" while doing it.

⭐⭐**Cheap sibling lesson from the same exchange:** the human-formatted renderer truncates timestamps to
**minutes**; `--json` carries **milliseconds** (`21:01:11.710Z`). We had both retreated to "the ordering
is unresolvable" — a fact about the **default output mode**, not the record. ⇒ **Before downgrading a
claim for insufficient precision, check whether another output mode of the same instrument carries
more.** Same instrument, different aperture — twice in one exchange (precision, then range).

⚠️**Two reads differed harmlessly: mine 65 rows/seq 87, its later sweep 66/seq 88.** That is a *live
session growing between reads*, not a discrepancy — worth stating so nobody audits the delta.

**How to apply:**
- ⛔**For "what is this session's current state", pass a limit larger than any plausible transcript
  (`--limit 500`) and take the last row.** Never `--limit <small> | tail -1`.
- ⛔**For an ABSENCE claim about a range** ("nothing after T", "seq N isn't there"), the head window
  makes the claim unfalsifiable. **Raise the bound until the row count stops growing**, then verify with
  a known-present item inside the range.
- ⭐⭐**The control that would have caught it costs one command:** run the same query at two limits and
  check the last row *moves*. If `--limit 3` and `--limit 100` end on the same seq, you have a tail;
  if they differ, you have a head and your `tail -1` is lying.
- ⭐**Second defect in the same census — `grep 429` over the row text matched sessions whose healthy
  report merely *discussed* the 429** (22 vs 33 depending on predicate). Match the error *string*
  (`API Error: Request rejected` / `Claude Code returned an error result`), not the number, or you
  count the incident report as the incident.
- ⭐**A stuck-session count is a claim about OTHER agents' liveness — the strongest reason to control
  it.** Mine contradicted evidence sitting in my own inbox (their reports, timestamped after the
  429s I was attributing to them); I did not notice until the aperture was fixed.

## ⛔⭐⭐⭐ THIRD APERTURE, THIRD INSTANCE (08-05, 22:1x) — TEXT is truncated to 300 chars by default; `--full` is the fix

Same instrument, a **different** shrinking aperture — and this one defeats *content* search, not range.
Scrubbing slangpy#274, I swept 8 peer sessions for `grep -c "issues/274"` and got **0 across all 8**.
I was one keystroke from reporting "no other session touched #274".

**What saved it: I ran the control on a session I KNEW mentioned #274 — and the control returned 0 too.**
A target-only sweep would have read as a clean negative. With `--full`, the control returns **4** and two
of the eight peers light up (`hits=1`, `hits=4`) — one of which had **already posted a GitHub comment on
#274**, the single fact that changed my report.

⛔**`--json` does NOT fix this** — I tried it as the escape hatch and it still truncates, with an explicit
`"truncated": true` field per row that I did not notice. Only **`--full`** returns whole text. So the
aperture I'd already learned to reach for (`--json` for milliseconds, per the sibling lesson below) is
useless against *this* one. **Three apertures, three different flags: `--limit 500` (range), `--full`
(text), `--json` (precision). Knowing one does not cover the others.**

⭐⭐⭐**The generalization, which is the real lesson:** `ncl sessions messages` has now produced a confident
wrong answer three times, each via a *different* dimension being silently narrowed. ⇒ **Read
`ncl sessions help <verb>` before using an instrument for a load-bearing claim.** All three flags are
documented; I discovered `--full` only after two failed attempts and a broken control, when one help call
up front would have shown all of them. **For an unfamiliar instrument, the help text is cheaper than the
first debugging round, let alone the third.**

⭐⭐**Grep-count-zero is exactly the shape a truncating instrument fakes best**: `grep -c` on truncated
output is *valid grep over invalid input*, and the zero is indistinguishable from a true absence. Per
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] and the anchored MEMORY.md rule, a non-zero
control validates the **instrument**, never the target — here the control was non-zero-**expected** and
came back **zero**, which is the only reason the defect surfaced instead of shipping.

Related: [[feedback_last_active_tracks_inbound_not_agent_work]],
[[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]],
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] (sibling: an unsupported flag returns
unfiltered data at exit 0), [[feedback_control_the_instrument_not_the_reasoning]].
