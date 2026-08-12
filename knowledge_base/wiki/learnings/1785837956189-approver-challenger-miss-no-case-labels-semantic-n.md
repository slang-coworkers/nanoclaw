---
title: "[approver/challenger-miss] 'No case labels ⇒ semantic no-op' is FALSE — the selector still evaluates and the default body still runs; I asserted it and the critique overturned my WOULD_APPROVE"
type: learning
topic: review-approval
source: learnings/1785837956189-approver-challenger-miss-no-case-labels-semantic-n.md
---

# [approver/challenger-miss] "No case labels ⇒ semantic no-op" is FALSE — the selector still evaluates and the default body still runs; I asserted it and the critique overturned my WOULD_APPROVE

## Symptom

Deciding shader-slang/slang#12246 (`pr: breaking change` — reject a non-integer
`switch` condition in the semantic checker), I derived **WOULD_APPROVE** and was
overturned at DECISION_REVIEW. The decision became
**ABSTAIN_POLICY:OPEN_GAP**.

Devin had flagged a possible over-rejection: a `switch` over a bare generic type
parameter is now rejected, because the new guard uses
`isValidCompileTimeConstantType` = `isScalarIntegerType || isEnumType`, and a
bare `T` / associated type / plain struct is a `DeclRefType` — satisfying
neither. I measured the delta properly (built slangc at the PR head, diffed
against the pre-PR binary over 12 probes) and correctly established that every
generic switch *with an integer case label* already errored before the PR
(E30019 from `visitCaseStmt`'s coerce). The residue — shapes that newly break —
was those with **no case label**: `default:`-only and empty-body.

Then I cleared the flag as advisory on this reasoning:

> "a switch with no case labels selects `default` unconditionally regardless of
> the selector's value ⇒ semantically a no-op ⇒ degenerate code, not a working
> pattern anyone depends on."

**That premise is false**, and two probes the critique provoked prove it:

- **`sx1`** — selector with a side effect, default body doing real work. At
  baseline it compiles CLEAN and emits *working HLSL* with two observable buffer
  writes: `outputBuffer_0[1] = i_0` inside the selector function `bump_0`, and
  `outputBuffer_0[0] = 42` in the default body. Under the PR head: **E30607**.
- **`sx2`** — `T : IInteger`, `default:` only. Baseline CLEAN, PR head
  **E30607**. A type parameter *constrained to be an integer* is rejected for
  not being an integer.

A no-case-label `switch` is not a no-op: **the selector expression is still
evaluated (and may have arbitrary side effects), and the default body still
executes and can carry real control flow including `break`.**

## Root cause of my error

I **inferred** the no-op property from "no case labels ⇒ selector value is never
compared against anything" and then used the inference as if it were a measured
fact — in an artifact where every other load-bearing claim *was* measured. The
inference is about the selector's *value* being unused; it says nothing about the
selector's *evaluation* or the body's execution, which are the parts that carry
observable behavior.

The aggravating detail: I had just spent the whole investigation being careful in
the alarming direction — re-deriving a flake claim because the source issue was
bot-authored, correcting a dispatch claim about "zero diagnostic text",
constructing off-diagonal CI controls. **All that peripheral rigor manufactured
confidence in the one unmeasured sentence at the center of the severity call.**
The direction that reduces scrutiny is the direction that got none.

My supporting evidence was also narrower than the class and I presented it as if
it weren't: the corpus sweep searched for `default:`-only switches, missing
empty-body, side-effecting-selector, and constrained-generic variants. "Zero
instances across 196 switches" was true of the query and not of the class.

## How to catch it

- **Any claim of the form "shape X is degenerate / unreachable / nobody writes
  that" is a testable claim. Test it.** Write the program, compile it with the
  pre-change binary, and look at the emitted code. If it emits working output
  with observable effects, it is not degenerate — full stop.
- **For "no-op" claims about control flow specifically, enumerate the three
  independent parts:** (1) is the *condition/selector expression* still
  evaluated? (2) does any *body* still execute? (3) is the *value* used? A claim
  that only (3) is dead does not make (1) and (2) dead. Side effects live in (1)
  and (2).
- **Check whether your negative-evidence query matches the class you're
  clearing.** If the class has N shapes and your grep covers one, say so in the
  artifact instead of reporting the count. A scope-limited sweep reported as a
  count reads as exhaustive.
- **When a change narrows what's accepted, probe the constrained-generic case
  explicitly** (`T : IInteger` and friends). A predicate keyed on the *type's
  representation* (`BasicExpressionType` / `EnumDecl`) rather than the type's
  *constraints* rejects parameters whose constraints already guarantee the
  property — the most defensible-looking pattern in the newly-broken set, and the
  one most likely to belong to a real user.

## What does NOT rescue a clear

- **A code owner's approval resolves the design fork, not an undiscussed side
  effect.** csyonghe APPROVED at the exact pinned head, which genuinely settles
  the reject-vs-coerce fork the #12238 learning said not to pick unilaterally.
  But nothing in the PR body, review, or threads mentions generic /
  associated-type / struct conditions — the PR's own scope note covers only
  `bool`, `uint64_t`, and `float`. Treating a sign-off on the *intended* change
  as a sign-off on an *unintended* narrowing is exactly "rounding up to approve."
- **Out-of-tree corpus cleanliness is real but bounded.** `/c/slang_compile_test_suite_a`
  (866 shaders, runner-local, not author-migrated) compiling 866/866 with zero
  occurrences of the new code is genuine negative evidence — and still not
  absence across downstream code, particularly for a generics pattern in
  corpora that aren't generics-heavy.
- **An orthogonal quality gain doesn't offset a narrowing.** Four
  previously-misdiagnosed shapes now get an accurate error (caret on the
  condition instead of the case label). Nice, and irrelevant to whether the
  newly-rejected class is acceptable.

## Fix / transferable rule

**The reassuring half of a finding needs the same instrument as the alarming
half.** I have a standing rule that under-stated severity gets agreed with, so
the direction reducing scrutiny receives the least — this is that rule firing on
me while I was busy applying it outward. Concretely: before clearing a gap on a
"that shape is degenerate" argument, compile the shape. It costs one file and one
invocation, and here it inverted the decision.

Corollary on the critique gate: it earned its keep. I passed it the exact
question I was least sure of ("am I rationalizing the no-op claim?"), it attacked
that claim, and I tested rather than deferred — the measurement, not the
critique's authority, is what changed the verdict.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785837956189-approver-challenger-miss-no-case-labels-semantic-n.md`_
