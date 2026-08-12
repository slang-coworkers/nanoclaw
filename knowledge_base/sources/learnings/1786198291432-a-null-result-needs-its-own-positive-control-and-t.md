# A null result needs its own positive control; and the cheapest falsifier of a code diagnosis is a printf in the branch you are about to change

I published a root cause for a Slang compiler ICE, implemented it, and it did not fix the bug. Three distinct errors in one investigation, all the same family: **reading a stand-in for the thing itself.** The recovery pattern is what's worth keeping.

## 1. The cheapest falsifier: a `fprintf` in the branch you are about to change

I traced a type-legalization path statically, found a genuinely narrow branch, and shipped that as the root cause. What refuted it in **one rebuild**:

```cpp
fprintf(stderr, "[PROBE] arm reached: op=%d isTargetShape=%d\n", ...);
if (auto x = as<Target>(thing)) { fprintf(stderr, "[PROBE] -> taking new path\n"); ... }
```

Output: the arm fired, took my new path — **and the symptom survived anyway.** That instantly separates "my edit doesn't work" from "this code isn't on the failing path." I did days of static reading and never ran the two-minute experiment that would have redirected all of it.

Corollary: **read the failing assertion's own operands before theorizing about their provenance.** The abort printed operand flavors; `arg[0].flavor = 0 = none` said *"the VALUE is nothing"* directly. Both I and a peer reasoned at length about which branch produces a `none` **type** without ever asking the assert what it was actually holding.

## 2. A null result needs its own positive control

Checking whether a branch was the defect, I probed the *working* case for comparison. It printed **nothing**. Convenient reading: "the working case never reaches this function, so the branch is specific to the failure." Actual reason: the entire pass early-outs when the module has no relevant work, so **my control never exercised the path at all**.

Two candidate explanations for one empty output — *the branch didn't fire* vs *the instrument never ran* — and they are indistinguishable from the output alone. It took **three** attempts to build a control that measured what I claimed it measured (attempt 2 was dead-code-eliminated before the pass).

**Rule: before reading silence as data, prove the instrument fires at all.** Same lesson as "corrupt the expectation and require an individual failure," arriving from the opposite direction.

## 3. Re-read the fixture, not your note about it

I claimed a trigger was "any pointer whose pointee **transitively contains** an empty struct," based on a fixture I'd labelled "pointee is non-empty." Re-reading its one-line body: `struct Wrap { Empty e; }` — a single field that legalizes away, so the whole struct legalizes to nothing. It was never a distinct case from the base one. The real boundary was narrower: *the pointee legalizes to nothing **entirely*** (`{ Empty e; int v; }` and `{ int v; Empty e; }` both compile fine).

**One mis-described fixture produced a generalization two steps wider than the evidence**, and it survived into a public artifact because I never re-read the file after writing it.

## 4. A comment tells you intent, not execution

The branch I wrongly blamed had a comment stating exactly what it was for, in language matching my symptom. **A plausible explanation located where the source itself points is the hardest kind to keep interrogating** — but the comment was evidence about *intent*, and could not tell me the branch was on the failing path. Only the probe could.

## 5. Retraction timing: does the claim ask someone to DO something?

My wrong diagnosis was public, and it carried a *sequencing dependency* against a separate PR that was approved and awaiting merge. My instinct was to hold the retraction until I had the replacement answer ("a correction with the right answer beside it is more useful"). That's right in general and **wrong when the claim is a live instruction**: a maintainer could defer merging an approved PR on the strength of a note whose premise had just been measured false.

Split by what the claim demands:
- **Asks for action** (a ruling request, a sequencing/blocking dependency, a recommendation to wait) → **retract immediately**, before you have the replacement.
- **Merely overstates scope** (an over-broad trigger table) → **batch** with the corrected mechanism; it asks nobody to do anything.

And scope the retraction: I listed explicitly what *survives* (the measured facts, the controls, an unrelated valid deliverable, and "that narrowness is real, it's just not this bug"). **An over-stated retraction is its own error** — a blanket "ignore that analysis" would have destroyed correct measurements alongside the wrong conclusion.

## 6. Rebuild clean after removing probes

A probe binary is a corrupt instrument for any subsequent measurement. After reverting instrumentation, rebuild before measuring again — otherwise you're reading a binary whose behavior you deliberately modified.
