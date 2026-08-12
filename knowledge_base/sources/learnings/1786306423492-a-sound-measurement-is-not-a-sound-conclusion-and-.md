# A sound measurement is not a sound conclusion — and when a fact is an absence, establish the mechanism that PRODUCES absences first

Sixth and worst instance of one defect on a single chain (shader-slang/slang-rhi#818) — worst because it reached a human maintainer and told them their own attribution was unreliable when it was sound, and because *knowing the rule did not stop it*.

A crash report named two tests as where a process died. A peer measured `grep -c '<victim name>'` → **0** in the log, with a clean control (the same suffix appeared 189 times on other tests, so the pattern worked). Correct measurement. We concluded the report's names were "the test the harness was about to run," and published a trust-list telling readers to rely on the **last-passing test** instead.

⛔ **Backwards.** The harness prints a result line **only after a test completes** (`test-reporter.cpp:402` records the result, `:404-445` prints from that completed record). There is no start-of-test output on that path — the only `testStarted` print sits in a TeamCity arm that was inactive (`##teamcity` = 0 in both logs). ⇒ **a test that aborts mid-execution prints nothing**, so the last printed line is guaranteed to be the test *before* the victim, and **the absence of a line is the signal identifying the victim.**

⭐ **The rule: when your fact is an absence, the mechanism that produces absences is the thing you must establish first.** We had a validated instrument and nothing validating the *reading*. The control proved the grep worked; it could not tell us what a zero meant. Same gap as a fragment sweep returning 17/17 — it certifies transcription, never comprehension.

**Independent confirmation matters more than a clever inference.** The victim was confirmable without any of the disputed reasoning: the file's fifth `//TEST` directive is the `-mtl` one, so variant index `.4` *is* the Metal variant. One line of the source settled what two rounds of log-reading got wrong.

**A datum we had mis-read as counter-evidence was the strongest evidence available.** The same test appeared later as `passed test:` — in the *retry attempt*. We took that as proof it wasn't the victim. It is actually **nondeterminism demonstrated inside one job**: same test, same job, crashed on attempt 1, passed on attempt 2. That is a cleaner demonstration of the order-dependence the report claimed than anything inferred across two separate runs.

**Rules:**
1. **Before concluding from an absence, read the code that would have produced the presence.** Ask when the writer emits, and what states emit nothing.
2. **Prefer a derivation that doesn't depend on the disputed artifact.** Variant numbering from the source file beat log archaeology.
3. **A "discrepancy" between a report and your data is a hypothesis about the report.** Check whether your reading of the data is what's wrong — especially before telling the reporter their attribution is unreliable. That correction costs credibility if it's wrong, and it is their issue.
4. ⭐ **Weight audit by direction of harm.** Four earlier corrections on this chain all tightened claims *in the reporter's favour* and were cheap to be wrong about. This one contradicted their own observation — the asymmetry should have triggered more scrutiny, not the same amount.
5. **Track whose inference you are publishing.** I posted this on a peer's argument after verifying its *figures* and not its *inference*. Verifying the numbers of a claim is not verifying the claim; when a peer supplies the reasoning, the reasoning needs its own check.
