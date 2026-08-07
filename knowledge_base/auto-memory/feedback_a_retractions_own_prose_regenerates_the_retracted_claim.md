---
name: feedback_a_retractions_own_prose_regenerates_the_retracted_claim
description: "slang#9146: the fixer's 7th error of the session was reasserting the just-retracted causal claim INSIDE the paragraph written to retract it. Retracting a mechanism does not remove it from your working vocabulary."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8246ae29-ea58-4221-b5b7-ef70556a0a7b
---

slang#9146 (2026-08-06). We published a causal claim ("LTO defeats `--exclude-libs` by dissolving
archive provenance"), then refuted it experimentally and retracted it publicly. The fixer logged six
claim/measurement errors during the work. **The seventh happened while drafting the correction
itself:** the first draft of the CI-coverage paragraph described the release build as *"the
configuration that leaks"* — reasserting, as settled fact, the exact causal link the surrounding
paragraph existed to withdraw. A gate caught it.

⭐⭐⭐ **A retracted claim does not leave your working vocabulary. It survives as the compact phrase
you used to think with — and correction prose is written *about* the topic, so it reaches for that
phrase first.** The shorthand is the danger: "the configuration that leaks" is four words that smuggle
in a causal assertion, where the honest version needs a clause ("the configuration in which the leak
is observed, trigger unidentified"). Retraction rewards brevity and brevity is where the claim hides.

⇒ **After retracting a mechanism, grep your own correction for the retracted entity's shorthand
before publishing.** Here: any phrase binding *LTO* / *the release configuration* to *leaking* as
cause. This is mechanical and takes seconds; the error is invisible on a read-through because the
sentence is locally true-sounding and topically correct.

⚠️ **Companion, same chain — an absence in a dispatcher file proves nothing, and its control says so.**
The fixer grepped `ci.yml` for `SLANG_ENABLE_RELEASE_LTO` → 0, then ran the control: **0 `SLANG_`
tokens in the entire file.** `ci.yml` is a pure dispatcher (30 `uses: ./.github/workflows/...` calls),
so it cannot contain any build flag — the zero was structural, not evidential. Correct method: search
the whole tree. Verified independently 2026-08-06: the token appears in **2 of 62** workflow YAMLs
(`release.yml:156`, `nightly-mdl-perf-test.yml:133`) and in none of the build workflows `ci.yml`
invokes (`ci-slang-build.yml`, `ci-slang-build-container.yml` — the latter is what the Linux x86_64
jobs route through). ⇒ **before reading a grep-zero as evidence, ask whether the file is even the kind
of file that could hold a hit.** Same family as
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] — a zero with a structural explanation is
not a measurement.

⛔ **Attribution matters here, and the fixer corrected me to keep it straight.** I recorded this 7th
error in a way that could read as *self-caught* — as if the session showed improvement. It did not:
**the gate caught it.** Final tally for the chain is **7 errors, 2 self-caught, 5 gate-caught.** The
fixer volunteered that correction *against their own credit*. ⇒ **The ratio, not the count, is the
finding: the critique gate is load-bearing for a class of error self-review reliably misses**, and
both of the most dangerous instances (a self-defeating export wildcard, a self-contradicting
retraction) were stopped at the gate rather than by the author. Operational consequence for whoever
configures overlays: **do not make that gate optional for symbol/measurement work.**

⭐⭐ **Why this pair is worth keeping together:** both are *second-order* failures — errors in the
machinery built to catch errors. The retraction reintroduced the claim; the control-run grep was
correct but pointed at a file that could not answer. **A correction step and a control step are code
paths too, and they get audited less than the claims they police.**

✅ **What worked: separating two tests that had been conflated.** The fixer initially reported "no
writable regression test" for this fix. Refined: a **symbol-table assertion** *would* check the real
property (its only weakness is that it cannot discriminate *this* fix, because the local environment
passes either way); a **linker-flag assertion** pins implementation presence, not the property. Both
recorded separately so a later session isn't told every possible test is vacuous. ⇒ **"no test is
possible" is usually two claims about two different tests; split them before recording the negative.**
