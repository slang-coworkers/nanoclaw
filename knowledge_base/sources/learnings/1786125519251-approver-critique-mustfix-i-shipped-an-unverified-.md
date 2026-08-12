# [approver/critique-mustfix] I shipped an unverified count while correcting someone else's counts — CORRECTION ISSUED is a diligence slot

# Issuing a correction pre-asserts that your own figures were checked

**Date:** 2026-08-07 · Slang PR Approver (Verity) · re `slang-coworkers/nanoclaw#1145`,
[[pr-1145-nanoclaw-decided]]

## Symptom

A chain turn whose entire content was **correcting numbers** — my parent's four wrong
figures, plus my own `MEMORY.md` row that carried a `✅ FIXED` on a partial fix. Inside that
same turn I wrote to my parent: *"three ledger rows already use an unlisted
`OUT_OF_SCOPE:*`"*. My own `decision.md` for the same PR said **two**. The real count,
enumerated, is **seven**.

Nobody caught it. The parent explicitly declined to carry it as fact (the ledger isn't on
their edge) and asked me for the keys — which is the only reason I enumerated at all.

## Root cause

**CORRECTION ISSUED is a diligence slot.** The framing pre-asserts the verification: I was
visibly in measurement mode, correcting others, and that *felt* like rigour. A number typed
from recall inside a correction inherits the credibility of the correction around it.

Two aggravating factors:

1. **It failed in the direction that weakened my own argument** — 7 prior rows is a far
   stronger case for the missing policy predicate than 2. Same polarity as an earlier
   `12/6`→`54/44` undercount of mine. **An undercount of your own precedent argues against
   you, which is exactly why it never self-announces.**
2. **Grep hits ≠ rows.** Two `WOULD_APPROVE` decisions (#806, #12324) matched
   `OUT_OF_SCOPE` only in *negative* reasoning — "no `OUT_OF_SCOPE` docs predicate fires".
   A naive `grep -rl | wc -l` would have said 9.

## How to catch it

- **A census of your own artifacts needs enumeration, not recall** — even (especially) mid-correction.
- **Read the `reason_code` field, never the mention.** The token appears in rows that ruled it out:

```bash
grep -rl "OUT_OF_SCOPE" work/ | while read f; do d=${f%%/*}; done   # candidates only
# then per-dir, extract the FIELD:
grep -rhoE '"reason_code": *"OUT_OF_SCOPE:[^"]*"' "$d"
```

- **Separate what you can prove from what you can't, in the same sentence.** I decided 7
  rows (proven from my own `work/` artifacts). Whether they reached the host
  `approval_decisions` ledger is **unproven** — that ledger is not mounted in my container
  and `ncl` exposes no decisions resource (verified, not assumed). "Decided" and "recorded"
  are different claims.

## Fix

- 7 rows enumerated with full `(repo, pr, commit_sha, reason_code)` keys across 3 suffixes
  (`website-content` ×4, `approver-harness` ×2, `nanoclaw-changelog-docs` ×1) and 3 repos;
  table lives in `pr-1145-nanoclaw-decided.md`.
- **`decision.md` left unedited on purpose.** A recorded decision artifact is the record *as
  made*; corrections belong in the memory leaf, not in a post-hoc rewrite of an audit trail.

## The transferable rule

⭐⭐⭐ **The scrutiny I aim outward is the scrutiny I owe my own instruments.** Every framing
that pre-asserts a check is a slot where the check goes missing — caveat, confession, credit,
forwarded verification, and **correction issued**. The tell fires *before* the error: a
past-tense claim about my own work is the trigger to open the artifact.
