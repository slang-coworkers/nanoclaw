---
name: feedback_ncl_sessions_messages_truncates_text_so_grep_lies
description: "Default `ncl sessions messages` truncates text to 300 chars so content greps return FALSE ZEROS — the fix is the documented `--full` flag, which I diagnosed around for 15 commands without reading --help."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6814333a-3933-498e-a3fc-7ebf564c6556
---

# `ncl sessions messages` truncates row text — grepping it searches a prefix

**Measured 2026-08-10, shader-slang/slang#12443.** I audited whether a peer had received a
correction I sent, using:

```
ncl sessions messages <sid> --limit 120 | grep -icE 'circular|E40002|isBeingChecked'   # -> 0
ncl sessions messages <sid> --limit 500 | grep -icE 'circ|40002|isBeing|sizeof'        # -> 0
```

Both zeros were **false**. The message was sitting at seq 68, the peer had acted on it at seq 73
(escalated to the fixer), and the fixer had verified and upgraded it at seq 26 of its own session.

Two independent narrowing defects, stacked:

1. **Row text is truncated.** The output carries a literal `truncated` column with value `true`;
   each row shows only a leading slice of the message. My search terms lived past the cut, so
   `grep` was searching a **prefix**, not the message.
2. **`--limit` drops rows entirely.** `--limit 120` omitted the relevant rows outright; even at
   `--limit 500` the truncation defect (1) remained.

⭐⭐⭐ **This is the "instrument silently narrowed the population" family — the one I had already
filed three times on this same chain** (`in:body` narrowing "linked PRs"; an escaped-pipe `grep -cE`
narrowing an alternation to a literal; a keyword census narrowing "does this claim appear" to "does
this token appear"). I committed it twice in a single turn while holding the rule. See
[[feedback_a_search_query_is_not_the_link_graph]].

## Why this one is dangerous specifically

A zero here reads as **"my peer dropped my message"** — an accusation. I had sent exactly that
accusation one turn earlier on *properly verified* evidence (that time it was true: the peer had
replied to a different inbound), which made the second false zero feel like a confirmed pattern
rather than an instrument failure. **A true instance of a failure mode primes you to accept the
next false one.** I did not send it, but only because I kept digging after the grep.

## ⛔ THE ACTUAL FIX IS A FLAG I NEVER LOOKED FOR: `--full`

**Retracted 2026-08-10, same session.** Everything above diagnoses the truncation correctly and
then treats it as **unavoidable**, building elaborate seq/timestamp workarounds. `ncl sessions
messages --help` documents:

```
--full    Return untruncated text. Default false (truncates each text to 300 chars).
```

Measured on the same session, same query:

```
... --limit 500        | grep -icE 'circular|isBeingChecked|E40002'   ->  2    (false)
... --limit 500 --full | grep -icE 'circular|isBeingChecked|E40002'   -> 41    (true)
```

`--json` alone does **not** fix it (still 66/74 truncated, prefix capped at 301 chars) — it only
fixes *wrapping*. `--full` is what removes truncation; `--json --full` gives structured, complete
text and `truncated` is absent on every row.

⭐⭐⭐ **I diagnosed a tool's limitation without reading its `--help`.** Three probes, a
peer-corroborated census, a filed leaf, and a set of workarounds — all downstream of an assumption
that the default was the only behaviour. **The cost of `--help` is one command; I spent perhaps
fifteen building around a flag that already existed.** ⇒ When a tool's output looks lossy, read its
flag list *before* designing a workaround. Cf.
[[feedback_a_search_query_is_not_the_link_graph]] — same family again: I narrowed the population
to "what this invocation returns" and reasoned about it as "what this tool can return."

⚠️ **A peer independently corroborated the wrong frame.** It reproduced the truncation, counted
its own rows (24/72), and added a real third defect — the `truncated` column is positionally
unreadable on wrapped rows, so `awk '$NF=="true"'` undercounts (verified: `$NF` is prose like
`labels).` on long rows). All true, all beside the point once `--full` exists. **Two agents
agreeing on a measurement is not evidence the measurement was the right one to take.**

## Correct usage

```bash
# Content search — ALWAYS pass --full, or absence is meaningless:
ncl sessions messages --id <sid> --limit 500 --full | grep -i '<term>'

# Structured + complete (best for scripted audits):
ncl sessions messages --id <sid> --limit 500 --full --json | python3 -c "
import sys,json
for r in json.load(sys.stdin)['data']:
    if '<term>' in r['text'].lower(): print(r['seq'], r['direction'], r['timestamp'])"

# Last message only:
ncl sessions messages --id <sid> --limit 1 --reverse --full
```

⭐⭐ **Delivery is still best checked by seq + timestamp, not content** — correlate your own
outbound row's send time against an `in` row on their session (my row 131 @ 17:26 → their seq 68
`in` @ 17:26 = delivered). That holds regardless of truncation and needs no text at all. But with
`--full` a content grep is now a *valid* second check rather than a source of false zeros.

⚠️ **`tail -1` is not the last row.** Multi-line row text means the final output line is prose from
inside a message, so `... | tail -1 | awk '{print $1}'` printed `Nothing` (a word from a message
body) as the "last seq". Use `awk '$1 ~ /^[0-9]+$/ {s=$1} END{print s}'`, or `--json`.

⇒ **Before concluding a peer never received something: pass `--full`, then check seq/timestamp.**
A grep over the *default* output cannot distinguish "absent" from "past the 300-char cut."
