---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788101780752-bd8ib7
written_at: 2026-09-03T13:57:55.935Z
---

# [approver/human-disagreement] OPEN_GAP on a trivial correct caller-less utility lacking a test — maintainer approved it as-is

## Case
slangpy#1129 "Add hash append utility": a +13-line header-only variadic template
`sgl::hash_append` added to `src/sgl/core/hash.h`, correct by inspection (mirrors
the file's existing tested `hash(...)` fold idiom), **no callers**, and **no
test** (a `test_hash.cpp` present in an early push was dropped and never
restored across 4 force-pushes). I decided **ABSTAIN_POLICY:OPEN_GAP** on three
successive heads (80aebfa4, ffce1c63, 0ca1ccb). On the 4th head a MEMBER
maintainer (**skallweitNV**) **APPROVED** the exact test-less commit.

## Both rationales
- **Mine (OPEN_GAP):** new public API ships with zero regression coverage; PR body
  Validation advertises a `sgl_tests` build that no longer exercises it
  (claim-vs-code mismatch); fallback tier (no production bot review) ⇒ extra
  caution; "a human must look."
- **Maintainer (APPROVE):** the utility is small, obviously correct, mirrors an
  existing pattern, and has no callers — evidently acceptable to ship without a
  dedicated unit test in this project.

## Lesson (transferable, calibration)
The missing-test signal is not one class. Distinguish:
- **Genuine OPEN_GAP** — a missing test where the untested code has a *plausible
  real trigger* (has/will-soon-have callers), *real blast radius*, or the absence
  *undermines a behavioral claim the PR makes*. Abstain.
- **Likely-waivable nit** — a *trivial, correct-by-inspection, caller-less*
  utility that mirrors an already-tested idiom. Maintainers here routinely ship
  these without a dedicated test. Repeatedly abstaining on this sub-class is
  over-conservative and matches the fleet base-rate (91% of abstains-with-verdict
  were later approved). It is the SAFE direction (never a false-safe), but it
  costs signal.

Practically: when the only gap is "no test" AND the code is trivial + correct +
caller-less + mirrors a tested sibling, weight toward CLEAR/nit rather than
OPEN_GAP, and reserve OPEN_GAP for missing tests with a reachable trigger or a
behavioral claim at stake. Note the *mid-review test drop* (which drove the
original R1 abstain) is a weaker signal than it first appears once the author
re-pushes the test-less version deliberately — deliberate repetition resolves the
"accidental drop?" uncertainty independently of any human review.

## Discipline preserved
The decision was held at OPEN_GAP **independently** of skallweitNV's approval —
the human verdict is host-joined for scoring, never used to derive the call
(else the approver launders the human decision and yields no signal). The
disagreement itself is the calibration output. Next review of a
trivial-utility-without-test should apply the sharpened bar above.
