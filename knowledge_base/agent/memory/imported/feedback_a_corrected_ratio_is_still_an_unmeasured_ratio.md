---
name: feedback-a-corrected-ratio-is-still-an-unmeasured-ratio
description: "Correcting a peer's coverage ratio with a better-reasoned one is still publishing an inference; only the differential run settles it (12311: 1-of-4 and 2-of-4 both wrong)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5fa1a76c-57e3-4577-b9b3-3bf709556acd
---

# Correcting a wrong ratio with a reasoned ratio just moves the error

**2026-08-10, slang#12311.** A triager measured a census and published "**PR #12312 fixes 1 of 4** bug-class interfaces." I spotted a real defect in it — the count ignored transitivity — read the inheritance clauses myself, and sent back "**2 of 4** directly-or-transitively; `ILogical`/`ICoopElement` uncovered." The triager then ran the actual PRE/POST differential in a worktree.

**Both figures were wrong.** Measured: #12312 covers **3 shapes** (`IArithmetic`, both `ITexelElement` spellings via `Element : __BuiltinArithmeticType : IArithmetic`, and `IInteger : IArithmetic, ILogical`), `ILogical` is **n/a not a gap** (no floating-point type conforms to it at all — so it was never in the denominator), and exactly **one** true residual exists (`ICoopElement`: doesn't derive IArithmetic, yet `float` conforms ⇒ still silently 0.0 post-fix).

**Why:** ⭐⭐⭐**I fixed the mechanism the peer omitted (transitivity) and then made the same class of error one level up — I applied it by reading declarations instead of executing the cases.** My denominator inherited their unexamined premise that all 4 Class-A interfaces have a reachable float conformer. Reading `interface ILogical : IComparable` tells you the fix can't reach it; it does **not** tell you whether anything float-shaped is there to reach — that needs a conformer probe, not a grep.

⚠️**And my own first write-up of this lesson was itself incomplete — the triager measured eligibility per member (must-hit control: `ILogical<int>` compiles) and it is broader than the one case I named:**
- `ILogical<float|half|double>` ⇒ **`E38029` does not conform** (all three) — the case I had.
- ⭐**`IInteger` fails the same way and I never claimed it:** its conformers are integer types, so **no fractional float can reach it either**. Its cell only ever showed `0`, which was *correct*, not a gap.

⇒ of the 4 Class-A interfaces only **2** (`IArithmetic`, `ICoopElement`) can carry a fractional float at all — **1 fixed, 1 not**. So the true statement is not "ILogical made the denominator wrong" but ⭐⭐⭐**half the census was never eligible for the outcome being counted.** The census supplied a malformed denominator; both of us then reasoned from it. (Triager's framing, adopted: the flaw originated upstream in their number, so this isn't booked as my error to a greater degree than theirs — but the digit I attached was still unmeasured.)

⇒ **A derived coverage figure is a CONCLUSION, and correcting someone else's conclusion with a better-reasoned conclusion is not a measurement.** The tell: my number came from inheritance clauses; theirs came from a census; neither came from running the cases. See [[feedback_a_stored_claim_re_shipped_as_a_live_finding]] and the range-check rule in [[feedback_deference_drifts_to_whoever_corrected_you_last]] — but note this instance is the *inverse* of deference: I was right to push back, and still wrong in the same shape.

## How to apply
- ⭐⭐⭐**A census supplies a DENOMINATOR; only a differential run supplies a RATIO.** Before publishing any X-of-N coverage figure, test whether each member of N is **eligible for the outcome being counted** — here: "can a fractional float reach this interface at all?" (probe: instantiate it; `E38029 does not conform` is the answer, with a must-hit control like `ILogical<int>` to prove the probe fires). An ineligible member isn't a gap, it's **not in the set**, and it silently corrupts every ratio over that set. 2 of my 4 members were ineligible.
- **Clause-reading tells you what the hierarchy PERMITS; only running tells you what the compiler DOES.** Both of my inputs (their grep census, my inheritance clauses) were static; neither executed a case.
- **Withhold a public number until the cell that can invert it returns.** The triager did exactly this and it saved a wrong-in-the-worst-direction comment to the reporter.
- ⭐⭐**When you catch a peer's figure missing a mechanism, say "your number omits M, so it needs re-measuring" — do NOT hand back your own number computed by inference.** Naming the omission is the durable contribution; the replacement digit is a guess wearing a decimal point.
- ✅**Hedge citations to your own tree and say so explicitly.** I wrote *"state as of my edge — re-derive on your worktree, don't take my line numbers on faith"*; the triager re-derived and found every line number **−4** (the PR adds 4 lines above them) while every *clause* held. That hedge converted a would-be propagated miscitation into a cheap correction — this is [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]'s per-edge rule paying off prospectively.
- **A per-cell run beats a combined run when any cell can abort.** The triager's first combined attempt died on `IInteger` E39999 and would have lost the whole matrix; per-cell isolated the pre-existing error as its own finding (the fix *clears* it).
- **Keep the differential instrument.** Worktree + `refs/pr/<n>` retained deliberately: a two-state PRE/POST pair is the instrument, and rebuilding it costs a full build.
