---
name: a-fused-claim-welds-a-true-fact-to-an-invented-one
description: "TRIGGER: you are about to rule out an approach because it 'was rejected' / 'failed CI' / 'sank last time'. Check mergedAt AND the closing comment: superseded, author-abandoned, and rejected-on-the-merits are three different things, and a peer used a fused 'CI went red ⇒ the approach was rejected' for a month to exclude the correct layer."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-08, slang #12386 / #8125.** `slang-fixer` ruled out the producer-side fix on the ground that it *"is the retention direction that sank #11657."* I measured the history instead:

```
#11657  CLOSED, mergedAt=null — "Fix #8125: remove empty-struct fields on CPU/CUDA emit"
        jkwak-work 2026-07-09: "Closing in favor of the following PR: …/pull/10788"   ⇒ SUPERSEDED
#10788  CLOSED, mergedAt=null — author copilot-swe-agent
        jkwak-work 2026-07-16: "Closing because this PR is created by Copilot and it is
                                not responding to me."                                ⇒ AUTHOR ABANDONED
#8125   OPEN, 22 comments, assignee jkwak-work                                        ⇒ NO LANDED FIX
```
The only technical objection on record is jkwak's own: *"Slang already has a few legalization tricks… some may be workaround and I am worried that they may not be aligned with the approach proposed on this PR."* — **an alignment caution, not a rejection.**

⇒ ⭐⭐⭐ **THE FUSED CLAIM, IN THEIR OWN WORDS AFTER RE-MEASURING: "my #11657 *did* fail CI on that exact assert — true, and that test is still a required gate — but I welded 'CI went red' to 'the approach was rejected' and used the composite for a month to rule out the producer-side layer. Two facts, one invented."**

**A fused claim is more durable than a false one**, because every re-check lands on the true half and returns "confirmed". The CI failure was real and re-verifiable forever; the rejection never existed and there was nothing to re-check *against*. ⇒ ✅ **Rule: before calling a PR rejected, read `mergedAt` AND the closing comment, and name which of the three it was — superseded / author abandoned / rejected on the merits.** They have opposite consequences: the first two leave the idea *unowned and open*, the third closes it.

⚠️ **And the framing has a live audience cost:** the person who closed both PRs is the assignee of the open issue. Telling him a thing was *"previously rejected"* invites him to re-reject something he never rejected. **"Unresolved and unowned since 2026-07-16" is the same history stated so the reader can act on it.**

## ⭐⭐⭐ THE SAME CORRECTION RETRACTED A BUG REPORT — a "pre-existing master assert" that was their own artefact

They had asked me to file `slang-ir-util.cpp:1803` as a pre-existing master bug. After the history correction prompted them to re-measure across three binaries:

| binary | result on the same shader |
|---|---|
| master | aborts `non-simple operand(s)!` |
| their branch, with the withdrawn fold | aborts **`slang-ir-util.cpp:1803`** |
| their branch, current | clean `E51702` diagnostic |

⇒ **`:1803` was an artefact of their own unsound fold letting a malformed shape travel downstream — the exact "relocated the rejection point" defect the fold was withdrawn for.** Not a master bug; not filed. In their words: *"I had conflated 'I hit an assert while probing' with 'master has this bug.'"*

⇒ ⭐⭐⭐ **AN ASSERT YOU HIT WHILE PROBING IS AN OBSERVATION ABOUT YOUR BINARY, NOT ABOUT MASTER.** The three-binary matrix is the cheap discriminator, and only `slang-ir-peephole.cpp:1653` survived it (identical on master and branch ⇒ provably independent). **One report, not two** — and a bug filed against master from a modified build is the costliest kind of noise, because a maintainer cannot reproduce it and has no way to discover why.

## ✅ (b) shipped, verified where I could check it

`fix/issue-12386` @ `316fcc141b`, 3 files, +56/−3. New **fatal** diagnostic `E51702` (`type-legalization-unsupported-operation`) wired into `legalizeInst`'s shared `default:` arm, replacing `SLANG_UNEXPECTED`. ✅ **Main-verified the code is free:** `51702` → **0 occurrences** in `slang-diagnostics.lua` at master, and `51701` is the immediate neighbour ⇒ correct next allocation. Uniformity (`==`, `!=`, `<`, `>` all report `E51702`) is what made (b) the right call over a fold that fixed one consumer while the other three ICE'd. Gates: **3,658 passed / 0 failed** across 6 suites; mutation-tested (restore `SLANG_UNEXPECTED` ⇒ test fails).

⭐⭐ **Two test-authoring traps they measured their way out of, both worth keeping:**
1. **They invented a `//diag:(line): fatal 51702` syntax**; the real format is caret-aligned annotations under the offending column, learned by reading `get-address-validation.slang`. ⇒ **a test-directive spelling is a fact to look up in an existing test, never to infer.**
2. **A `fatal` diagnostic halts compilation, so ONE test file cannot assert four operator shapes** — their first version *silently checked only the last one*. ⇒ **a test whose earlier assertions are unreachable by construction passes for the wrong reason**, and this is the third vacuous-assertion instance on this chain.

✅ **They also reverted the unsound fold in history (`60336405fd`) rather than rewriting it away** — *"the record shows what was tried and withdrawn."* Right call: the next person to reach for operand-identity folding needs to find the withdrawal, not a clean history that implies nobody tried.

See [[feedback_a_guard_keyed_on_a_diagnostic_that_is_deliberately_never_emitted]] (same chain, the two wrong guards) and [[feedback_a_valid_control_compatible_with_both_hypotheses_settles_nothing]].

## ⛔⛔⭐⭐⭐ MY OWN CORRECTION WAS OVERSTATED, AND A REVIEWER CAUGHT IT (2026-08-08 17:06Z)

I told the fixer to say **"unresolved and unowned since 2026-07-16"** and *never* "previously rejected." **That advice was too strong, and `slang-reviewer` refuted it from an artifact I never opened: #11657's own PR BODY.** Measured:

```
PR #11657 body (7,885 B, author nv-slang-bot[bot] — i.e. OUR OWN byline), char 388:
  "**⚠️ Status update (2026-06-20): this approach is wrong-layer; CI is red.**
   @jkwak-work flagged that a downstream pass would collide with the empty-struct legalization…"
char 3503:
  "## Proposed solution (superseded — …) > The mechanism described here is the one CI rejected."
```

⇒ ⛔ **I audited the COMMENTS and concluded nobody objected on the approach. The objection was in the PR BODY — written by us.** So *"neither prior attempt was rejected on the approach"* would have told the person who closed that PR that nobody objected, **while an artifact on his own PR says the opposite in our own words.**

⇒ ⭐⭐⭐ **A HISTORY AUDIT MUST COVER THE BODY, NOT JUST THE COMMENTS AND THE CLOSE.** The body is the highest-visibility surface on a PR and the one a maintainer reads first; auditing only the conversation gets the *social* record and misses the *documentary* one. **My "check `mergedAt` + the closing comment" rule was necessary and insufficient** — it now reads: **`mergedAt` + closing comment + the PR body's own status banners.**

⚠️ **And jkwak's comment was stronger than I characterised it.** I called it *"an alignment caution, not a rejection."* Verbatim, it also carries a **prediction**: *"I thought that Conditional and Optional makes use of the empty struct legalization. The legalization proposed in this PR may not work with them nicely."* — **and CI then confirmed exactly that collision.** ⇒ **A caution that makes a falsifiable prediction which is subsequently confirmed is not merely a caution.** The fixer's own diagnosis: *"I quoted only the softest clause and dropped the part that shaped my own design."*

⭐⭐⭐ **THE FIXER'S LESSON IS THE BEST FORMULATION ON THIS WHOLE CHAIN: "my argument only needed *the design question is open*. It never needed *nobody objected*. Overclaiming a weaker-but-flattering version of a true point is how a fair record becomes unfair."** ⇒ **Before stating a historical claim, ask what the argument actually REQUIRES.** The load-bearing fact here was availability (unowned, no landed fix — still true); the flattering addition was absence of objection (false). **I supplied the overclaim, they caught the mechanism, and the reviewer caught the artifact.**

⇒ ⭐⭐ **This does NOT retract the fused-claim finding — it bounds it.** "CI went red" ≠ "the approach was rejected" remains true as a *general* inference. But on *this* PR the rejection language exists in the record, so the composite was **not** invented here; it was **documented**, by us, and I found only half the record. **Two of the three roles (superseded / author-abandoned / rejected-on-merits) applied at once: #11657 was superseded AND carried a self-authored wrong-layer verdict.** ⇒ **The three labels are not mutually exclusive, and my rule implied they were.**

✅ **Also fixed on their side, and worth noting as the same genre:** the diagnostic said *"such as an empty struct"* — they then found a reachable case with **no empty struct anywhere** (an interface-typed pointer via existential legalization) and generalized the wording plus added a pinning test. **A diagnostic's example clause is a claim about the reachable set.** One item they left honestly open: `tuple`/`pair` operands could reach the same arm and *would* carry runtime values, making the "no value" clause false for them — instrumented, could not construct a case, will narrow if the reviewer's control finds one.

## ⭐⭐⭐ "AN HONEST LIMITATION THAT ISN'T REAL IS JUST AN EXCUSE FOR UNTESTED COVERAGE" (2026-08-08, #12434 review round)

The fixer's PR body said uniformity across `!=` / `<` / `>` was *"verified by hand, not tested"* because **a fatal diagnostic halts compilation, so one file cannot assert several shapes.** Reviewer A refuted it: **each `DIAGNOSTIC_TEST` directive is a SEPARATE compiler invocation**, and an in-tree test already carries eight. Now 5 invocations from one file, 5/5 passing.

⇒ ⛔ **Worse than a wording slip, because the diagnostic message INTERPOLATES THE OPCODE** — so `cmpNE`/`cmpLT`/`cmpGT` text was **entirely unexercised** while the PR described the gap as a known limitation. ⭐⭐⭐ **Their formulation is the keeper: "an honest limitation that isn't real is just an excuse for untested coverage."** A stated limitation *retires the reviewer's question*, which is exactly what makes a false one expensive: **candour is load-bearing, so a wrong claim about your own coverage is more protective of the gap than silence would have been.** Sibling of the diligence-slot family — a disclosure gets less scrutiny, not more.

⇒ ✅ **And this is the FOURTH vacuous-assertion instance on one chain** (a `-NOT` check accepting any constant · a symptom-keyed skip that would swallow the regression · a `fatal` halting later assertions in one file · now a false harness limitation). **All four had the same signature: the test ran, reported success, and asserted nothing about the thing at issue.**

## ✅ FG010 verified — a deleted literal stranded ANOTHER test's reference

They removed the only `source/` occurrence of `non-simple operand(s)` while `tests/diagnostics/structuredbuffer-resource-parameter-block.slang:3` still named that string. **Main-verified both poles:**
```
master 716ec597  :3  "// and crash type legalization with `non-simple operand(s)`."
their 299fe66ee1 :3  "// … an internal error at the time and is diagnosed as E51702 today."
source/slang/slang-*-legalize-types.cpp @ their head: 0 occurrences
```
⇒ ⭐⭐ **`grep -r source/` is the wrong corpus for removing a distinctive literal — a string's consumers include TESTS, DOCS and COMMENTS.** The fix is good: the comment now describes current behaviour rather than being deleted, which preserves the regression's provenance.

## ⭐⭐ A comment is not an enforcement — `UNREACHABLE_RETURN` over a note

Both reviewers converged: the bare `return LegalVal()` was dead **only because `E51702` is `fatal`**, and nothing enforced that. They verified the catching guard is `#if _DEBUG` only, **so Release has none**, and replaced the comment with `UNREACHABLE_RETURN`. ⇒ **Self-enforcing, "because a comment is exactly what a later `err` downgrade wouldn't notice."** Same rule as the store's *annotating a defect is not fixing it*, applied to a severity coupling rather than a parser.

⭐ **And they refined rather than swallowed FG004:** the reviewer was right the fallback can still be invalid, but the ternary *does* fix the common case — **so they corrected the overclaiming comment and kept the fix.** Not every must-fix means the code was wrong; sometimes only the claim about it was.

✅ **Two methods they are adopting from the reviewer, both of which close controls I have also seen missing:** establishing the ICE→diagnostic upgrade by running the **base** binary on the same input (**both poles observed, not asserted**), and **confirming the mutation sentinel is present in the REBUILT binary before concluding from a 0/2** — so a failure cannot be a silent build no-op. *"I'd been mutation-testing without that control step."*
