# [approver/clause-gap] My own three-outcome fix was wrong in the third outcome — the evaluator maps unevaluable→ABSTAIN_INFRA, so a `not_applicable`/`unevaluable` waiver would abstain 100% of shadow decisions; the waiver must stay non-blocking and be fixed at the reporting layer

# [approver/clause-gap] Read the consumer before proposing a status value

## Symptom

Across three rounds I committed to splitting `ci_green_on_sha` into three outcomes:
`pass` (checked + green) · `unevaluable` (checked, red/incomplete/wrong surface) ·
`not_applicable` (policy waived — **never** `pass`). My orchestrator endorsed it, and
by the last round it was "the *only* protection on slangpy," priority raised.

Then I read the consumer. `scripts/eval-clauses.py:7-11` is explicit:

```
any clause FAIL        -> ABSTAIN_POLICY (reason CLAUSE_FAIL:<name>)
any clause UNEVALUABLE -> ABSTAIN_INFRA  (reason CLAUSE_UNEVALUABLE:<name>)
all PASS               -> continue to the verdict parse (Step 2)
```

and `:244-246` / `:293-296` build the summary from exactly three buckets —
`pass`, `fail`, `unevaluable`. There is **no fourth bucket**, and any status that
isn't `pass` either abstains or vanishes from the summary entirely.

So my fix, applied literally:

- `not_applicable` — **falls through every bucket.** It's in `clauses[]` but in no
  summary list, so the skill's "all PASS → continue" test silently treats a clause
  that reported nothing as satisfied. A new *silent* false-safe, worse than the loud
  one I was fixing.
- reusing `unevaluable` for the waiver — with `require_ci_green: false` set globally
  in `v0-shadow-wide`, **every** decision hits `:184`, so **100% of shadow decisions
  become ABSTAIN_INFRA**. That destroys the entire measurement program the waiver was
  set to buy (the policy `_comment` records the widening precisely to cut a 53%
  abstain rate), and it would burn the infra gate to zero signal.

**The fix I was most confident about was the one that would have broken the
pipeline.** It survived three rounds of mutual scrutiny because both of us were
reasoning about what the *token* should mean, never about what the *consumer* does
with it.

## Root cause

A status value is an interface, not a description. Proposing one without reading its
consumer is the same defect as reading one CI surface without asking whether the fact
lives there — I checked that `pass` was wrong (true) and never checked that my
replacement had a defined destination.

Note also the asymmetry that made it feel safe: `unevaluable` is the *conservative*
value, so substituting it reads as strictly-safer. It isn't — it's a different
failure (abstain-everything) with a real cost, and "conservative" is not a synonym
for "correct." Same shape as an over-correction being under-audited because retreat
feels safe.

## How to catch it

Before proposing any new enum value / status / return code:

```bash
grep -n "def clause\|summary\|== \"pass\"\|status ==" scripts/eval-clauses.py
grep -rn "unevaluable\|ABSTAIN_INFRA" <the skill that reads the output>
```

Falsifiers: (1) the value has no branch in the consumer ⇒ it will be silently
dropped, and "dropped" usually resolves to the permissive path; (2) the value maps to
a terminal state ⇒ check what fraction of real inputs would now hit it (here: 100%).
**Always compute the blast radius against the current policy**, not against the case
that motivated the change.

## Fix

Keep the waiver **non-blocking** — it must not abstain — and fix it at the
**reporting** layer instead of the status layer:

- keep `status: "pass"` so the pipeline continues (policy genuinely does not require
  CI green; that is an authorized, human-signed tradeoff), but
- make the evidence string self-indicting and machine-greppable, e.g.
  `"NOT VERIFIED — policy waives CI (require_ci_green=false); no CI surface read"`,
  and
- surface it as an explicit **caveat on the decision record** so a `WOULD_APPROVE`
  never *reads* as CI-verified. The ledger already carries clause evidence, so this
  is a string + a report line, not a control-flow change.
- The genuinely broken branch is `:190` (combined-status `success` ⇒ `pass` on a
  surface that cannot see Actions check-runs). That one **should** become
  `unevaluable` unless check-run *conclusions* were compared — and its blast radius
  is zero today, because `:184` short-circuits it while the waiver stands.

So the ordering I asserted twice ("split the token first, then the surface") is
**also wrong**: the split, done as I specified, is harmful; the surface fix is
harmless but currently unreachable. Correct order: (1) evidence-string + record
caveat now, (2) `:190` → verdict-comparison so it's right when the waiver lifts, (3)
a real fourth status **only** alongside a consumer change that gives it a bucket.

**Method, the durable half:** I asserted this fix in three consecutive reports with
rising confidence and never opened the file. Endorsement by a peer is not
verification — it was the same claim being repeated, not re-measured. *Read the
source before proposing a change to it* is in my standing instructions; proximity to
the rule did nothing.

Siblings: the `:184` waiver-branch entry; "a retraction is not self-verifying";
`ci_green_on_sha` reads the legacy combined-status API.
