# [approver/false-safe] Built the ABSTAIN-vs-merged join and it immediately found a SECOND unambiguous false-negative — slangpy#1002, era-correct policy, no staging bug involved: no_protected_paths fired on a PR that merged APPROVED with a clean APPROVE/0-gap review

# [approver/false-safe] The detector's first run found a false-negative the staging investigation would never have reached

## Symptom

I owed a standing detector for the conservative-direction failure class — a decision the
procedure got *right*, recorded as an abstain, where nothing alerts because caution looks
like caution. Built it (`/workspace/agent/tools/abstain-merged-join.py`): join every
recorded Step-1 abstain against the PR's real outcome, flag `merged + reviewDecision
APPROVED + Step-2 verdict APPROVE/APPROVE_WITH_NITS with 0 bugs`.

**28 abstains joined. 10 flagged HIGH. Strict filter (same decided head, `APPROVE`, 0
gaps) yields 2 unambiguous false-negatives:**

```
slangpy#918  @57259b457b4c   clause=head_provenance      (known — staging fallback)
slangpy#1002 @34e5df38dddf   clause=no_protected_paths   (NEW)
```

**#1002 is the finding.** Its policy was `v0-shadow-relaxed` — **era-correct, no staging
bug**. `no_protected_paths` fired legitimately per that policy, on a PR that merged with
`reviewDecision: APPROVED` and whose Step-2 review was `APPROVE`, 0 bugs, 0 gaps, at the
same head I decided. So the procedure would have agreed with the human, and the clause
prevented it — not through a defect, but because the pre-widening policy genuinely
protected `.github/**`.

That is precisely the case class the human-signed `v0-shadow-wide` widening was created
to stop (its `_comment`: *"`no_protected_paths` fired exclusively on `.github/**` (32
cases…)"*). **#1002 is a measured instance of the cost that motivated the widening** —
and it was invisible until joined against outcomes.

Plus 8 rows needing Step-3 judgment (`APPROVE_WITH_NITS` with 2-4 gaps, or a
different-head decision): `#1078`, `#1084`×3, `slangpy-samples#57`×3, `#1002`×1. Those
may be legitimate `OPEN_GAP`s — not counted as false-negatives without reading each,
which is the mistake I already made once today by generalizing from clause state.

## Root cause of the blind spot

Two distinct causes of the same recorded outcome, and only one had been investigated:

| cause | example | detectable by |
|---|---|---|
| wrong policy loaded (staging fallback) | #918 | policy-version audit |
| **correct policy, over-strict clause** | **#1002** | **only an outcome join** |

The staging investigation could never have found #1002 — its policy was right. A
version audit answers *"did we use the intended rules?"*; it cannot answer *"were the
intended rules wrong?"* **The outcome join is the only instrument that sees both**, which
is exactly why it belonged on the list and why its first run paid for itself.

## How to catch it

```bash
python3 /workspace/agent/tools/abstain-merged-join.py      # 28 rows, severity-sorted
```

Severity rules: `HIGH` = merged+APPROVED and review clean; strict false-negative adds
same-head + 0 gaps. Falsifiers guarded in the script: (1) different decided head ⇒ weaker
claim, flagged; (2) `gaps > 0` ⇒ Step 3 may legitimately abstain, held back for review;
(3) `reviewDecision REVIEW_REQUIRED` ⇒ no human agreement to compare against, scored `ok`
(the seven `slangpy-samples#53` rows and `#1063`/`#1085` land here correctly).

Note the artifact constraint that shaped the design: only **1 of 57** workspaces retains
`tmp/record-payload.json`, but **all 57** have `clauses.json` + `tmp/context.json`. So the
join is built from the durable artifacts, not the ledger — worth knowing before assuming
recorded payloads are available for any retrospective.

## Fix

- Re-record **#1002** alongside #918 for calibration; both are agreement data the record
  currently reports as abstains.
- Run this join **periodically**, not once. It is the only detector for the class, and it
  costs one command.
- Feed the strict count upstream as evidence *for* the widening, not against it: #1002 is
  the widening's own justification, measured after the fact. This is the concrete form of
  "53% abstain rate, 91% of decisive abstains approved."
- Keep the 8 soft rows as a work queue requiring individual Step-3 reads.

**Method note:** the item sat on my to-do list as bookkeeping. It found a new
false-negative on its first execution, in a case the entire 14-round investigation had no
path to. **A detector for a silent failure class is worth building even when you think you
already found the instances** — the instances you found are the ones some other signal
surfaced.

Siblings: the #918 human-join entry; the staging-fallback entry; "a spurious abstain fails
in the socially invisible direction."
