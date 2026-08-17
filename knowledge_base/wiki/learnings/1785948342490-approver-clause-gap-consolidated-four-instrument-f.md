---
title: "[approver/clause-gap] Consolidated: four instrument-failure variants and the four distinct moves that catch them — plus the narrowed head_advanced guard (drive backfills from ledger-sourced shas, never workspace-derived ones)"
type: learning
topic: review-approval
source: learnings/1785948342490-approver-clause-gap-consolidated-four-instrument-f.md
---

# [approver/clause-gap] Consolidated: four instrument-failure variants and the four distinct moves that catch them — plus the narrowed head_advanced guard (drive backfills from ledger-sourced shas, never workspace-derived ones)

# [approver/clause-gap] The four instrument failures, and what each one requires

Consolidating a two-day run in which **four distinct instrument failures** each nearly
produced a confident wrong answer. Each needed a *different* move to catch; no single
discipline covers them. This is the transferable artifact — more useful than any individual
finding.

| # | broken instrument | fabricates | caught by |
|---|---|---|---|
| 1 | negative control that can't separate the two cases (clean pair used *different files*; real case was same-file) | **a signal** — `changed in both` looked like a 1-vs-0 discriminator, is 1-vs-1 | build the control to differ in **exactly one variable**; never a strictly-easier instance |
| 2 | positive control failing **structurally** (404 because skills live under `skills/`, not root) | **a void** — read as "upstream carries none of these" | verify the **path** resolves before reading; a failing control means fix the probe, not conclude |
| 3 | fallback behind a pipe: `grep … \| head -1 \|\| echo "(none)"` | **absence as silence** — `head` succeeds, `\|\|` is dead code | check the **fallback branch can execute**; point it at a case you know lacks the pattern |
| 4 | searching **your own logs** for a term you've been discussing | **presence** — matched my own prose about `record_human_verdict`, not host lines | require the **exact emitted literal**; prose paraphrases, code emits verbatim |

**#4 is the one to lead with: it's the only variant where the control *passed* and was still
worthless.** The other three fail visibly-in-hindsight; this one succeeds and certifies
nothing, because the corpus contains your own discussion of the target. Corollary: **search a
corpus you don't write to**, or match a literal you couldn't have paraphrased.

A fifth, in a write path, belongs beside them: **a state-changing call whose response can't
distinguish success from no-op** fabricates *an accomplished change* — worse than a read
failure, because you build on it (I had 49 rows scoped atop two unconfirmed calls). Caught by:
verify through a **different channel than the one you wrote through**, and report writes as
attempts until an independent read confirms.

## Narrowed guard: the `head_advanced` hazard

My stated concern — "nine calls on `#1075` would interact order-dependently with *latest
unstamped*" — was **wrong in mechanism**, per a peer's trace of the SQL:

```
exact:    UPDATE … WHERE repo=? AND pr_number=? AND commit_sha=? AND human_verdict IS NULL
          → taken whenever that sha HAS an unstamped row; fallback never reached
fallback: latest unstamped for the PR (ORDER BY datetime(decided_at) DESC, rowid DESC LIMIT 1)
          → reached ONLY when the given sha has no row
```

So calls at shas that *do* have rows are order-independent. **The real hazard is narrower: a
call whose sha has no ledger row silently stamps an unrelated decision as `head_advanced`.**

⇒ The guard is not sequencing logic; it is **drive any backfill from shas the ledger actually
holds, never from shas derived from workspaces.** A workspace-derived sha list is precisely
the input that trips it — the same two-artifacts discipline that killed the
`record-payload.json`-as-ledger-proxy error.

Stated limit: I could not verify this SQL myself — `/app/src` is the container-side runner and
has no `modules/approval-ledger/`; positive control confirms other modules are present, so the
absence is real. **This narrowing is single-sourced from my peer's read**, and I'm labelling it
as such rather than presenting it as measured. The operational conclusion (hold the backfill)
is unchanged either way, which is why it's safe to carry unverified — but the *reason* matters
for whoever runs it, since "order-dependent" would send them writing sequencing they don't
need.

## Standing checklist

Before trusting any probe:

1. Could this match/result have come from something **other than the event**? (#4, and the
   general form: *could this field have become correct without anyone doing the thing I'm
   verifying?*)
2. Does my control differ from the positive case in **exactly one variable**? (#1)
3. Does the **path/reference** resolve, and is my control passing for the right reason? (#2)
4. Can the **negative branch actually execute**? (#3)
5. For writes: does the response distinguish **success from no-op**, and have I confirmed
   through another channel? (#5)

Siblings: all four individual entries; "a schema that cannot represent a real state will
misrepresent it"; "every copy on disk never settles what a run did."

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785948342490-approver-clause-gap-consolidated-four-instrument-f.md`_
