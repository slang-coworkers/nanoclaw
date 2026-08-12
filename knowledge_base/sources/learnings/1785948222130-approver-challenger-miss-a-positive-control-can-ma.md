# [approver/challenger-miss] A positive control can match your own writing ABOUT the artifact — grepping my session logs for record_human_verdict "hit" because I'd been discussing it for an hour; only the exact emitted string discriminates

# [approver/challenger-miss] The corpus contained discussion of the thing, which pattern-matched the thing

## Symptom

Needing to know whether two `record_human_verdict` calls landed, I checked whether I could
grep the host log myself. The host emits one of three exact strings
(`src/modules/approval-ledger/store.ts:147-211`):

```
approval decision joined to human verdict                  (joinMode: 'exact')
…joined to human verdict (head advanced past the decision) (joinMode: 'head_advanced')
human verdict had no unstamped decision to join            (nothing to join)
```

My first pass over `/workspace/agent/logs/` looked productive: a keyword search for
`approval decision` / `record_human_verdict` matched three files, and one file matched the
commit prefix `57259b457b4c`. That reads as "the host lines are here."

**They weren't.** The matches were **my own conversation text** echoed into session
transcripts — I had been writing about `record_human_verdict` and those two SHAs for an
hour. Requiring the *exact* emitted strings gives **zero** matches across every log file.
These are container logs; the host log isn't visible from here at all.

## Root cause

A positive control assumes the corpus either contains the artifact or doesn't. But when
the corpus is **a record of your own reasoning about the artifact**, it contains
*discussion of* the artifact, which keyword-matches it. The more attention I'd paid to a
topic, the more certain a keyword search over my own logs was to "confirm" it.

This is a self-referential variant of the day's recurring pattern, and it fails in the
**confirming** direction — unlike the earlier ones:

| broken instrument | fabricates |
|---|---|
| negative control that can't separate cases | a signal |
| positive control failing structurally (wrong path) | a void |
| fallback behind a pipe | absence as silence |
| write no-op returning success | an accomplished change |
| **searching your own logs for a term you've been discussing** | **presence** |

The discriminator is specificity: a keyword appears in prose *about* the mechanism; only
the **exact emitted string** appears when the mechanism *ran*. Prose paraphrases; code
emits verbatim.

## How to catch it

- Search for the **exact literal the code emits**, copied from source — not a keyword, not
  a paraphrase. `grep -c "approval decision joined to human verdict"` → 0 settled it where
  `grep "approval decision"` → 3 files misled.
- Ask **what else in this corpus could produce this match?** If the corpus is your own
  transcripts, memory, or notes, the answer is "my own writing," and any topical search is
  circular.
- Check the **line shape**: host lines carry a `[tag]` prefix and structured fields;
  transcript hits sit mid-sentence in prose. A match with no surrounding log structure is a
  quote, not an event.

## Fix

- Confirmed I cannot verify the two stamps from my container; the operator's grep is the
  only path. State it as a blocker, not as an unknown I might resolve.
- **Never grep your own logs/memory to confirm an external event occurred.** They record
  what you *said*, not what happened. Use the emitting system's log, keyed on its exact
  string.
- Corollary for this whole class: **for any search, the falsifier is "could this match have
  come from something other than the event?"** — the same question as *"could this field
  have become correct without anyone doing the thing I'm verifying?"*, applied to text
  search instead of state.

**Secondary finding, unrelated to the instrument:** the `head_advanced` path means a call
against a sha with no exact row stamps the **latest unstamped row for that PR** instead of
skipping. So a naive 49-row backfill on multi-head PRs (`#1075`×9, `#1084`×4, `#1082`×4)
would interact order-dependently with "latest unstamped" and could stamp rows I didn't
intend. **That is a correctness reason to hold the backfill, independent of whether the
rows exist.**

Siblings: the failing-positive-control entry; the write-no-op entry; "could this have
become correct without anyone doing the thing I'm verifying?"
