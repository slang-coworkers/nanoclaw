---
title: "A pass on a pooled resource is evidence about the draw, not about the fix — and a 0-success box is negative capacity, not a fraction of it"
type: learning
topic: ci-tooling
source: learnings/1785941832757-a-pass-on-a-pooled-resource-is-evidence-about-the-.md
---

# A pass on a pooled resource is evidence about the draw, not about the fix — and a 0-success box is negative capacity, not a fraction of it

## Part 1 — the pass measures the draw

CI jobs declare `runs-on: <label>`, which is a **pool**, not a machine. A rerun cannot target a runner. So when one box in the pool is broken and you rerun a failed job:

- it may land on a healthy box and **pass**, and
- that pass is evidence about **the box it landed on**, not about the defect.

Observed 2026-08-05 (shader-slang/slang, `Compile Regression`, 3-box Windows pool): SLANGWIN5 was 0-for-6 with a broken `spirv-val` (`PASSING [ 866 / 866 ]` compiling, `PASSING spirv-val [ 0 / 866 ]`, exit 255). A rerun landed on SLANGWIN4 and passed clean (`spirv-val [ 866 / 866 ]`, 0 FAIL lines). **Nothing was fixed.** The job escaped.

Corollary that bites hardest: **testing a repair requires drawing the suspect box.** A green on a different member cannot settle the defect either way — so remediation must not wait on it.

### The selection effect is severe and it runs one way

Successful escapes are invisible in PR-level pass/fail, so the pool always looks healthier than the bad box:

| | reality |
|---|---|
| SLANGWIN5 | **100% red** (6/6 fail) |
| pool as seen per-PR | **~26% red** (a PR only fails if it *draws* the bad box, ~1 in 3) |

≈**3× understatement** with a 3-box pool. Any flake rate computed from PR outcomes is diluted by the pool size.

### The rule

**Record which runner the job landed on before drawing any conclusion — and record it on the FAILING attempt too, not just the passing one.** Per-runner affinity ("4 of 7 draws hit the bad box") needs the prior attempt's runner, and `runner_name` on the job object is only readable while the log lives. One field, captured at the time, or the analysis is impossible later.

## Part 2 — don't concede a capacity cost you haven't measured

The natural objection to depooling a bad box is "that reduces capacity." Volunteering it is honest. **Reasoning it from box *count* is the error.** Measured output inverted it here:

- The bad box **did not fail fast** — ~10.6 min per failure, a *full* job slot consumed for zero return. Not a cheap lottery ticket.
- **It occupied the pool during the very contention it was blamed for.** A 26.2-min queue wait was capacity-bound with all three boxes busy — and the bad box was one of the three, mid-failure.
- **Each failure induces a rerun**, drawing again from the same pool. It is a capacity *multiplier* on the downside: one draw costs the wasted slot **plus** a whole second job.

⇒ **A box with 0 successes is not 1/N of capacity; it is negative.** Correct framing: *depooling removes 0 successful capacity and stops ~10.6 min of occupancy per draw plus the induced rerun — throughput may improve.*

## The general form

**"I measured a different object than the one my claim is about."** The pool label makes the substitution invisible — exactly as a `gh-readonly-queue/<base>/pr-N-<sha>` branch name does when its trailing sha is the *base* rather than the evicting merge commit. When a result surprises you or conveniently confirms you, name the object it is actually about: *which sha, which box, which attempt.*

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785941832757-a-pass-on-a-pooled-resource-is-evidence-about-the-.md`_
