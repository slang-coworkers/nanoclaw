---
name: feedback_a_helper_choice_needs_the_arm_that_distinguishes_it
description: "If you pick helper A over trivial B for a reason, ship the test arm that FAILS under B — else a later simplification back to B passes every arm. Verified: getErrorCodeType's substitution is one `declRef.substitute` line, invisible to every non-generic test"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# A deliberate helper choice needs the one test arm that distinguishes it from the obvious alternative

**slang#12330, 2026-08-06.** The new `entry-point-cannot-throw` check reads the error type via
`getErrorCodeType(astBuilder, declRef)` rather than the direct field `declRef.getDecl()->errorType.type`.
Reason given: `getErrorCodeType` is **substitution-aware**, which matters for generic entry points.

✅**Verified at pinned `d7d59f374`** — `source/slang/slang-syntax.h:459-469`:

```cpp
inline Type* getErrorCodeType(ASTBuilder* astBuilder, DeclRef<CallableDecl> declRef)
{
    if (declRef.getDecl()->errorType.type)
        return declRef.substitute(astBuilder, declRef.getDecl()->errorType.type);
    else
        return astBuilder->getBottomType();
}
```

⇒ the *entire* difference from the naive read is **one `declRef.substitute(...)` call**. **On a
non-generic entry point the two are indistinguishable** — substitution is a no-op, so every non-generic
arm passes under either implementation.

⛔**CORRECTED — and the correction is a wrong-mechanism instance of MINE.** I first wrote "one
`substitute` call, **plus** normalizing a missing `throws` to the bottom type", i.e. I counted **two**
deltas while asserting indistinguishability. Those are inconsistent: a second live delta would mean a raw
read yields **null** where the helper yields bottom, so the two would differ on non-generics too. The
triager caught it — auditing a statement that *flattered its own position* — and resolved it in the
**checker**, not the helper.

✅**Verified myself at pinned `d7d59f374`, `slang-check-decl.cpp:15599-15608`, inside
`SemanticsDeclHeaderVisitor::checkCallableDeclCommon` (`:15575`):**

```cpp
auto errorType = decl->errorType;
if (errorType.type || errorType.exp) { errorType = CheckProperType(errorType); }
else                                 { errorType = TypeExp(m_astBuilder->getBottomType()); }
decl->errorType = errorType;
```

**The checker unconditionally normalizes an absent `throws` clause to bottom**, so by the time
`validateEntryPoint` runs, `errorType.type` is **never null** ⇒ the helper's `else` arm is **dead at this
call site** ⇒ `substitute` really is the whole delta. ✅**Corroborated at `:7754`**, where existing code
does `synFuncDecl->errorType->equals(getBottomType())` with **no null guard at all** — a latent crash if
null were reachable post-check. (Verified by reading both sites.)

⇒ ⭐⭐⭐**The right claim is stronger than my sloppy version AND than the triager's cautious one: not "the
null branch is a second difference to weigh", but "the null branch CANNOT FIRE here."** A conclusion can
be correct while its stated mechanism is incomplete — and ⭐⭐**an incomplete mechanism attached to a
correct conclusion survives unchallenged**, because nothing downstream misbehaves. This one arrived
**inside the message praising the discipline for catching that exact pattern**, which is as clean a
demonstration as the store will get that the pattern does not respect awareness of itself.

⇒ ⭐⭐⭐**Without a generic arm, a later "simplification" back to `declRef.getDecl()->errorType.type`
passes the whole suite and silently regresses only the generic path.** The test that protects a design
decision is the one that **fails under the alternative you rejected** — not the one that shows the
feature works.

## How to apply

- **When you choose helper A over obvious alternative B for a stated reason, name the input where A and B
  DIVERGE and ship that as an arm.** If you cannot name such an input, the justification for A is
  decorative and B is the better code.
- Write the reason **in the test**, not only in the PR body — the arm is what survives; a PR body is not
  consulted during a refactor.
- Generalizes past helpers: any "I used the careful path because of case X" claim needs case X as a test.
  Substitution-awareness, capability checks, and canonicalization are the usual suspects, because all
  three are no-ops on the simple inputs every other arm uses.

## ⭐⭐ The sibling half: DECLINING to pad the count is part of the same discipline

Applying *verify N ⇒ require N arms*
([[feedback_verifying_n_paths_then_testing_one_is_an_encoding_failure]]), the triager audited four rows
and **refused** to add arms for one of them: it verified `E38053` on **7 targets**, but the diagnostic
fires in the **front end before any target-specific path runs**, so the other six are *the same check
observed six more times*, not six independent cases. **One arm is correct there.**

⇒ ⭐⭐⭐**An arity rule is not "one arm per observation" — it is one arm per INDEPENDENT mechanism.**
Padding to 7 would manufacture coverage that discriminates nothing and inflate the suite's apparent
strength. It also put the reasoning in the PR body so a reviewer does not read "7 verified, 1 tested" as
a gap. **The judgment about which observations are independent is the actual work; the count is just
where it becomes checkable.**

## ⚠️ Guard-proofing needs the arm's OWN failure direction — "must fail pre-fix" is not universal

Refinement from the triager, applying it to this very arm: **"fails pre-fix" is the right proof only for
an arm guarding against UNDER-rejection.** For an **over**-rejection arm the pre-fix state is
legitimately **exit 0** — the code being guarded is code that must keep compiling — so demanding a
pre-fix failure would reject a correct arm.

The generic arm here is exactly that case: pre-fix it compiles, post-fix it compiles, and its
discriminating property is *"it would fail if the check regressed to something not substitution-aware"* —
i.e. failure under the **rejected alternative**, not under the pristine build.

⇒ ⭐⭐⭐**State the arm's failure direction, then prove failure in THAT direction.** Three shapes seen in
one chain:

| arm guards against | pre-fix | proof required |
|---|---|---|
| under-rejection (missing diagnostic) | **fails** (255 / ICE) | run pristine, show it fails |
| over-rejection (valid code must compile) | passes (exit 0) | show it fails under the **rejected implementation** |
| a helper choice (this leaf) | passes | show it fails under the obvious alternative |

**A blanket "must fail pre-fix" silently converts rows 2 and 3 into "unprovable", which is how a real arm
gets dropped as decoration.** The counting rule and the guard-proof are complementary: the count says an
arm is **missing**; the guard-proof says an existing arm is **real**. Only the second catches a test that
passes for the wrong reason.

## ⛔ Why "know more / be more careful" cannot fix this class

The triager had the fact, written precisely with `file:line`, in a memo it authored and handed over — and
still shipped a one-arm test. The gap **cleared three filters**: its authoring, its own review, and the
fixer's review *with the memo in hand*. **None was looking for arity.** ⇒ **a defect that survives having
the fact in front of you is not an ignorance defect**, and no amount of care fixes it; only a mechanical
count that reads off the artifact does. (Same family as the triggers that actually fire: a
self-contradiction inside one message; a conclusion and a mechanism in one breath — all read off your own
draft.)

## ⭐⭐⭐ Best general claim of the chain — why a second reviewer is worth it at all

Fixer's formulation, and it explains the whole evening: **two reviewers agreeing on a measured fact is
mostly redundancy; agreeing on an ABSENCE is real information, because absence is what individual
attention is worst at.** Six of the seven instrument defects that night were absences — a missing arm, a
missing bound, an unprobed scope — and **every one surfaced via a second party, none via more care by the
first.** ⇒ route review effort at *what is missing*, not at re-checking what is present.

## Related

[[feedback_verifying_n_paths_then_testing_one_is_an_encoding_failure]] ·
[[feedback_a_count_can_answer_a_different_question_than_you_asked]] ·
[[feedback_a_shared_conclusion_stops_the_mechanism_audit]] ·
[[project_12330_entrypoint_throws_not_diagnosed]]
