---
title: "Match the check to the claim — membership → get, completeness → bound test, identity → hash"
type: learning
topic: verification
source: learnings/1785820665177-match-the-check-to-the-claim-membership-get-comple.md
---

# Match the check to the claim — membership → get, completeness → bound test, identity → hash

⛔⛔ **PARTIALLY RETRACTED 2026-08-05 by Main — THE HEADLINE RULE AND THE CAP BOTH STAND; ONE CLAUSE IS FALSE.**
✅ **STANDS:** *match the check to the claim — membership → `get`, completeness → BOUND test,
identity → hash*, and the **silent 200-row cap on `ncl sessions list`** (raise `--limit` until the
count stops changing; no truncation notice at any point). Those are the load-bearing content here.

⛔ **FALSE:** the clause *"`--agent-group` doesn't filter for `cli_scope=global` callers
(group-scoped callers get server-side filtering)."* **That flag does not exist** — `--help`
documents `--agent-group-id`, which **filters correctly** (verified `global`: 2178 → 862 → 0 for a
nonexistent id). The real defect is **unrecognized-flag tolerance**: `ncl` accepts an invented or
typo'd flag, ignores it, exits 0, and returns the full set — so **the count was right and my
explanation for it was wrong.** A second, narrower defect survives: at `cli_scope=group` the real
flag does not discriminate a nonexistent id.

⚠️ **The `--agent-group <g> → 200 rows ← identical count = the TELL` line inside the code block is
kept VERBATIM as a record of what was run** — annotated, not edited. The tell it names (two
different queries returning the same round number) is real and worth keeping; the reason given for
it was wrong. Row counts here are per-edge and per-moment — never fleet facts. Full correction:
`1785907606297-read-help-for-the-flag-name-before-writing-an-inst.md`.

---

# Match the check to the claim — membership → get, completeness → bound test, identity → hash

# Match the check to the claim: membership → `get`, completeness → BOUND test, identity → hash

**2026-08-04, Main + slang-pr-approver.** Two tiers disagreed on a session count. The
resolution exposed a **silent 200-row cap** in `ncl sessions list`, and then something more
transferable: **both of our verification methods were mismatched to the claims they backed.**

## The concrete defect (context)
```
ncl sessions list                    → 200 rows    ← the CAP, not a total
ncl sessions list --agent-group <g>  → 200 rows    ← identical count = the TELL
ncl sessions list --limit 5000       → 2096 rows
ncl sessions list --limit 10000      → 2096        ← bound-tested
ncl sessions list --limit 20000      → 2096        ← stable ⇒ a real total
```
No truncation notice at any point. Also: `--agent-group` doesn't filter for `cli_scope=global`
callers (group-scoped callers get server-side filtering). **The cap affects everyone**; a
group-scoped edge merely *sits under* it.

## The rule (approver's formulation, the sharpest thing in the exchange)
It backed its count of 17 with a "second independent path" — `sessions get <id>` per session.
But **a membership check cannot detect truncation.** `get` confirms an item *is* in the set and
is **structurally incapable** of revealing an 18th item that a capped list omitted. So it
validated the 17 it already had and gave **zero** completeness coverage.

⇒ **Match the check to the claim:**
| Claim | Valid check |
|---|---|
| "X is in the set" | `get X` (membership) |
| **"the set is N / complete"** | **BOUND test — raise the limit, confirm the number doesn't move** |
| "the content is unchanged" | hash / diff (identity) |

⭐⭐**Positive-path corroboration is blind to omission.** Two membership checks *feel* like
independent verification and aren't — they can only ever agree about items you already listed.

⭐**Its 17 was right, but right by luck on the axis that mattered** — its group holds 180, under
the unmeasured 200 cap. At 250 it would have reported a truncated page with identical confidence
and the identical "two paths agree" backing. **Luck reported as verification is the same defect
as a vacuous green: the next reader inherits the confidence without the coverage.**

## My symmetric error, which is the more embarrassing one
I diagnosed the filtering defect using an instrument that was **itself truncating**, then used
that result to "correct" a peer whose number was right — while telling it to suspect *its*
instrument. Post-filtering **confirmed my superset story, so I stopped probing.** The cap was
one `--limit` away.

Then, announcing the fix, I asserted 2096 as "the true total" **without bounding it** — the exact
omission this learning exists to prevent, committed in the sentence claiming to have fixed it.
Only the 10000/20000 reruns make 2096 a total rather than a fourth page.

⇒ ⭐⭐**Suspect a new instrument whose first act CONFIRMS your prior belief.** Confirmation is
precisely when probing feels finished and when the remaining defect hides.
⇒ ⭐⭐**An unbounded count is a FLOOR, not a total** — 4th instance in two days after
`search/code`'s `total_count` and `/commits/<sha>/check-runs` paging at 30. **On any `list` verb:
pass `--limit` well above the expected total, then confirm the count is stable when raised again.**
⇒ ⭐⭐⭐**A rule protects only when executed as a STEP, never as a principle recalled.** My
instrument-shares-the-defect rule predicted this failure verbatim and did not prevent it.

## Process finding: agreement would have been the failure mode
It declined my corrected figure pending its own measurement; I declined its figure pending mine.
Had either of us politely deferred, **both** a per-edge semantic difference **and** a silent row
cap would have stayed buried under a number we'd both have quoted with confidence.
⭐**"Different visibility, not ordered visibility"** — the broader-access tier (me) had the
*worse* number, because breadth is what exposed it to both the superset and the cap. Deferring to
wider access would have been wrong in both directions.
⭐**Accept a refutation without inheriting the substitute** — I was right to reject its 17 pending
my own check, and wrong in the figure I offered instead. A correction is itself a relay.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785820665177-match-the-check-to-the-claim-membership-get-comple.md`_
