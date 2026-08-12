# [approver/calibration] A bot finding that a named human maintainer already overruled ON THIS PR is not an OPEN_GAP — and two bots agreeing measures shared priors, not correctness

# Read the human review thread before scoring any structure/maintainability gap

**Context:** shader-slang/slang#12322 @`ba156ebf5c900ff89189c15347bafded7b4280ee`,
decided WOULD_APPROVE 2026-08-04.

## Symptom

Two independent review bots flagged the same item, one of them at top severity:

- **Devin** — its *only* finding, presented as a "Potential Bug":
  the `-emit-cpu-via-llvm` → `SLANG_PASS_THROUGH_LLVM` predicate is duplicated at
  `tools/slang-test/slang-test-main.cpp:1531` and `:4654` "instead of the single
  shared helper the change description promises".
- **CodeRabbit** — `🟠 Major`, `cr-indicator-types: refactor_suggestion`:
  "Centralize the forced-backend mapping… As per coding guidelines, keep one
  source of truth."

Two bots, independently, one at Major. The naive read is escalation:
`ABSTAIN_POLICY:OPEN_GAP`.

## Root cause — the finding is the maintainer's explicitly requested outcome

The PR history inverts it. An earlier revision (`5720ea9e3203`) DID have the
extracted helper `getForcedDownstreamBackend`, its own header
`slang-test-backend-requirements.h`, and a new unit test. Human maintainer
**`jkwak-work` (MEMBER)** reviewed it and asked for exactly the opposite:

> The coding style of this function is inconsistent to how the other parameters
> are handled. It looks like the intention is to make the new function
> unit-test-able. But I prefer to be consistent to the existing code rather than
> make the code harder to read only to test the simple logic.

The author complied in `eb64b1292b4f` ("Address review: handle
-emit-cpu-via-llvm inline, matching sibling requirements"), deleting the helper,
the header, and the unit test — and told CodeRabbit so: *"Declined. This
suggestion is opposite to the jkwak's review comment."*

So the duplication both bots flagged **is** the reviewed, requested shape.

## How to catch it

Before scoring any maintainability / structure / "extract a helper" gap, read the
**human** review thread at all three endpoints — `pulls/N/reviews`,
`pulls/N/comments` (inline, with `in_reply_to_id` chains), and
`issues/N/comments`. Specifically look for: a bot suggestion the author
*declined*, and *why*. An author's "Declined, because <maintainer> asked for the
opposite" is a pointer to a human decision, not a dismissal to be second-guessed.

Two supporting tells on this PR:
- **Devin's own category field said "Repo rule"**, and its impact text never
  claimed either site behaves incorrectly — a 🔴-shaped presentation over a
  maintainability claim. Read the category and the impact text, not the glyph.
- Both bots cite the *same repo style guideline*. Agreement between two tools
  applying the same written rule is one signal, not two.

## The transferable rules

1. **A bot finding that a named human maintainer already overruled on this PR is
   not an OPEN_GAP.** Abstaining would invert the signal: "a human must look" is
   precisely what ABSTAIN_POLICY buys, and here the human already looked and this
   code IS their requested outcome. Escalating it would re-litigate a settled
   maintainer decision and add review latency with no new information.
2. **Two bots agreeing raises confidence about the *observation*, not about the
   *severity*.** When both are applying a repo style rule the maintainer
   explicitly traded away for readability, agreement measures shared priors, not
   correctness. Independence of *tools* is not independence of *premises*.
3. **A "Bug"-labelled finding whose own body claims no incorrect behavior is a
   severity-presentation artifact.** Verify the two sites are actually equivalent
   (here: same predicate, disjoint reachability, idempotent OR effect — so drift
   is a future-maintenance risk, not a present defect), then score on that.

## Fix

Score structure/maintainability gaps only after answering: *has a human already
ruled on this exact point in this PR's review thread?* If yes and the code
reflects their ruling, the gap CLEARS with that citation recorded. Note the
residual honestly — here, a genuinely stale PR description §3 still promising the
now-deleted helper — as an advisory nit reported upstream, not a blocker.
