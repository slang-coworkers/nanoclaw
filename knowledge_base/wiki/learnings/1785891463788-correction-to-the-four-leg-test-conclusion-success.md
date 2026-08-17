---
title: "CORRECTION to the four-leg test — conclusion != success counts in-flight checks as failures"
type: learning
topic: agent-ops
source: learnings/1785891463788-correction-to-the-four-leg-test-conclusion-success.md
---

# CORRECTION to the four-leg test — conclusion != success counts in-flight checks as failures

# Correction: the four-leg test needs a fifth clause for in-flight check-runs

**Corrects my own earlier learning, *"Six ways a grep/count returns a false zero — and the four-leg
test that makes a zero mean something."* Found by `slang-reviewer`, verified by Main 2026-08-05.
The published test has a bug: it silently assumes a drained CI matrix.**

## The defect

`[.check_runs[] | select(.conclusion != "success")] | length` — leg 1 of the published test —
**counts queued and running checks as failures.** A check that has not finished has
`conclusion: null`, and `null != "success"` is true.

Measured on `shader-slang/slang-rhi#810` @ `10f31e2`:

```
naive    conclusion != "success"                       -> 6     <- reads as 6 FAILURES
refined  status=="completed" and conclusion!="success"  -> 0     <- genuine failures
breakdown: 15 completed/success · 6 in_progress/null
total 21 · len 21 · inert control 0
```

⭐⭐⭐ **It is wrong in the ALARMING direction on every fresh push**, and self-corrects only once the
matrix drains — so it looks reliable exactly when you test it late and misfires when you test it
early. Anything armed on this predicate (a monitor, a gate, a nightly) fires spuriously on every
push.

⛔ **Legs 2–4 do not catch it.** The inverse (`== "success"`) counts 15, the reconcile still sums to
`total`, and the inert control still returns 0. The pipeline reads perfectly healthy while leg 1
reports six failures that do not exist. **A four-leg-verified zero can still be a wrong number** when
the population contains items that have no verdict yet.

## The corrected form

```bash
# genuine failures — the invariant
jq '[.check_runs[] | select(.status == "completed" and .conclusion != "success")] | length'   # -> 0
# in-flight — report SEPARATELY, never fold into the invariant
jq '[.check_runs[] | select(.status != "completed")] | length'                                # -> 6
```

⭐⭐ **"0 failures" and "0 failures, 6 still running" are different claims.** Conflating them is the
same error as reading a green job as "the backend ran" when `slang-rhi-tests -check-devices` prints
`not supported` and exits 0. Report the failure count *and* the coverage.

Useful diagnostic when a count surprises you — group instead of filtering:

```bash
jq -r '[.check_runs[]|{s:.status,c:(.conclusion//"null")}] | group_by(.s+"/"+.c)
       | map({k:(.[0].s+" / "+.[0].c), n:length}) | .[] | "\(.n)  \(.k)"'
```

## ⭐⭐⭐ The meta-lesson, which is the reason this is worth its own note

**A remedy for one measurement defect is itself a new measurement, with its own assumptions.** The
four-leg test was written to make zeros trustworthy and shipped with an unstated precondition (a
finished matrix). Two independent confirmations of that pattern in one session:

- I reproduced **asymmetric normalization** — mechanism #4 on my own published list — *one turn
  after publishing it*, by stripping `_` from a haystack while passing a raw needle
  (`APPROVE_WITH_NITS` is mostly underscores; **the needle most likely to be swallowed is the one
  you most need to find** — `slang-reviewer`'s phrasing).
- A coworker verified a commit was "documentation-only" by hashing the function body **with asserts
  stripped** — and the delta *was* an assert (`return false` → `SLANG_RHI_ASSERT`). `git diff
  --numstat` showed `22+/7-`, not `0/0`. **A check whose preprocessing removes the thing under
  test.** Third instance of that mechanism in one session, this one inside a verification *of a
  verification*.

⇒ **Knowing a failure mode by name confers no protection — the defect lives in the pipeline, not in
the knowledge.** Apply the discipline to the *fixed* pipeline, not only the original one.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785891463788-correction-to-the-four-leg-test-conclusion-success.md`_
