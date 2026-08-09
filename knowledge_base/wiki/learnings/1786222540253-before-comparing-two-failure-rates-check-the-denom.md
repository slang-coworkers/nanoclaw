---
title: "Before comparing two failure rates, check the DENOMINATOR is the same population — a job-name split turned a '4.5x gap' into no gap at all"
type: learning
topic: misc
source: learnings/1786222540253-before-comparing-two-failure-rates-check-the-denom.md
---

# Before comparing two failure rates, check the DENOMINATOR is the same population — a job-name split turned a '4.5x gap' into no gap at all

**2026-08-08.** Asked to judge whether a flake's CI rate (6.3%) genuinely differs from a maintainer's locally-measured ~1-in-6 (~17%), I nearly published "4.5× higher locally — the trigger is more reproducible off-runner." **The comparison was invalid twice over, and the second flaw reversed the conclusion.**

**Flaw 1 — numerator unit.** My 6.3% was an **all-cause** job red rate (27 failing `test-falcor` jobs / 430). The human measured **one specific test crashing**. Decomposing the 27 by signature: **16** were the `GBufferRTTexGrads` AV (confirmed by checking `HSigmoid` *passes* in each — the tracked issue's own discriminator), **10** had expired logs (151 B + rc=1, or 1.1–2.3 KB bridge bodies) so were unclassifiable, and **1** never reached the image tests at all (control token count 16 vs 268; the log ends in git submodule config — a distinct earlier-stage failure). Sum = 27, verified.

**Flaw 2 — denominator population, the one that mattered.** The 430 "tested" legs mixed **two different jobs**: `test-falcor / Test (Falcor)` (203, runs the image tests) and `test-falcor / Test (Falcor Perf)` (227, a separate suite that *cannot* hit this test). All 16 AVs were in `Test (Falcor)`. Using 430 diluted the rate by ~2×:

| denominator | AV rate |
|---|---|
| 430 (both jobs — WRONG) | 3.7% |
| **203 (image-test job only)** | **7.9%**, ceiling **12.8%** if all 10 expired were AVs |

Against local ~16.7%, 7.9–12.8% **brackets it too closely to assert any difference** — especially since the human's figure is a small same-day sample (CI on that same day: 4 falcor failures, 2 of them AV). So the honest answer to "is the gap real?" is **no, I can't say it is** — the opposite of what the diluted number implied.

**Probes:**
- **Name the denominator's population out loud before dividing.** "Failing X / all X" is wrong whenever X spans variants that can't all produce the failure. Two jobs sharing a prefix (`test-falcor / …`) are *not* one population.
- **Bound the unclassifiable rather than dropping it.** 10 expired logs → compute a floor (all non-AV) and a ceiling (all AV). If your conclusion flips between floor and ceiling, you don't have a conclusion.
- **Check for internal retries before treating job count as attempt count.** I verified `ci-falcor-test.yml` has no retry loop and `retry-on-gpu-failure` only fires on `merge_group` GPU-health failures, so jobs ≈ attempts here. Had the job retried internally, the denominator would have been wrong a third way.
- **A ratio between your number and someone else's is the highest-risk claim you can make**, because each side was measured on its own population and the mismatch is invisible once both are percentages.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786222540253-before-comparing-two-failure-rates-check-the-denom.md`_
