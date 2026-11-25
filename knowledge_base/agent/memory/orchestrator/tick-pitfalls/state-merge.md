---
type: runbook
description: supervisor-state merge and scan pitfalls of the /supervise-issues tick — delta overcounting, key-by-key merge, mid-tick edits, bare-string values, hand-journaled chains, missed outbound (ticks 269-380).
---

supervisor-state merge and scan quirks. Parent: [[orchestrator/supervise-tick-pull-pitfalls.md]].

- **scan's `delta=updated` overcounts** when a cache refresh moves stamps backwards (tick 269: 59 raw → 20 real). Filter
  real updates by activity after the previous pull's start (`real-why.json`). It can also be entirely real (tick 276).
- **Merge state key-by-key:** scan's `state` drops closed chains, so after writing it back, re-add every pre-tick key
  the scan omitted (tick 284: 9 closed keys would have been lost).
- **A Main session can edit an existing key's `disposition` mid-tick, and scan's `state` silently reverts it** — scan copies the disposition from the pre-tick state, so `out[k].update(scan[k])` overwrites the live edit (tick 335: #14053's 12:00Z ready-flip disposition). Merge onto the live file, then for every key where live ≠ pre-tick, re-apply the live fields that changed.
- **Not every state value is a dict:** `gh-issue-shader-slang/slang-12432_note` is a bare string, so a key-by-key merge that does `dict(old).update(new)` crashes. Merge dicts, assign anything else verbatim (tick 306).
- **A Main session can journal a new chain into `supervisor-state.json` between ticks** (tick 331: #14398 written 03:30Z with a disposition). scan then reports it `updated`, not `new`; diff the state's keys against the previous tick's `state-final.json` and count such keys as 🆕 (force it with a 🆕 `notes.json` entry).
- **When building the board message, append the 🔼 rows to the 🆕 table with no blank line in between** — a blank line ends the markdown table and the 🔼 rows render as raw pipes (caught before sending, tick 331).
- **New-chain diff must union `_archived`.** State has ~830 top-level keys plus ~1,260 in `_archived`; diffing threads
  against top-level keys alone reports ~1,250 false "new" chains. Sub-thread sessions (`…-<n>/<suffix>`) need a
  `subthread:` journal entry by hand — scan never creates one (tick 288).

- **A brand-new chain's mid-turn outbound can be missed by 2+ pulls (tick 380, #14652):** the lo-cache reuses the
  prior tick's `our_last_outbound` whenever the chain's session set and per-session `last_active` are unchanged —
  but `ncl`'s `last_active` does **not** move on an outbound-only message (fixer "⚙️ build" ack at 02:13Z, session
  last_active stayed 01:54:13Z), so the pull kept serving 01:55:24Z and scan read the chain as silent. Both the
  03:00 gate and the full scan flagged it. Fix: before dispositioning a fixer-no-PR nudge as genuine, read the
  owning fixer session's transcript (`ncl sessions messages <id> --reverse --limit 3`) — the outbound is there,
  and record `advisory:fixer-active` for one tick.
- **Tick 385: a `notes.json` demote pass that only mutates the dict in memory is lost** — it must end in `json.dump`, or the stale 🔼 markers resurface in the next board render (#10232/#13973, caught at review).
