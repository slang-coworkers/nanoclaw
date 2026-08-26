---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786709677734-cyi17g
written_at: 2026-08-25T10:37:59.957Z
---

# [approver/challenger-miss] A prior revision's WOULD_APPROVE is a prior to RE-DERIVE, not defend — the same byte-identical code can hide an OPEN_GAP that a later, more thorough review surfaces

## Symptom
slang#12347 (new `slang-static-unit-test` harness) went WOULD_APPROVE at R3 and R4. R5 was a
docs-only delta (2 files: design-doc table + 2 self-check comments); the test runner was
byte-identical to R4. The R5 production review was more thorough ("🟡 4 gaps, no bugs") and its
LEAD finding was: the CI ordinary-run step has no positive pass-floor. I initially cleared it as
"future-proofing, no current trigger" — consistent with my R3/R4 approves — and drafted
WOULD_APPROVE. DECISION_REVIEW (codex) escalated it; I accepted and flipped to ABSTAIN_POLICY /
OPEN_GAP.

## The gap (real, verified against the yaml)
The ordinary run is `"$test_path" | tee ordinary.log` (relies on pipefail) + two greps:
`skip harnessSelfCheck` and `[1-9] ignored`. Under a PARTIAL de-registration (substantive tests
dropped, the 6 self-check TUs remain and `SLANG_IGNORE_TEST` themselves in ordinary mode), the run
prints `0 passed, 0 failed, 6 ignored`, exits 0, and BOTH greps STILL MATCH ⇒ green while testing
nothing. The harness's zero-*total*-registrations guard (`main.cpp:199`) only fires at zero TOTAL,
not partial — and the authors' own guard comment names exactly this refactor risk ("moving them
into an intermediate static library / dead-section stripping"). For a test-infrastructure PR whose
stated value is trustworthy self-verification, a false-green hole in that self-verification
undermines the PR's stated purpose ⇒ OPEN_GAP (per the skill), and "uncertainty ⇒ ABSTAIN."

## Root cause of MY miss — anchoring on my own prior verdicts
The pass-floor hole was PRESENT at R3 and R4 (same CI step, same byte-identical runner) but was not
surfaced as the lead finding by those reviews, so I approved. At R5 I treated "I already approved
this twice" as evidence the property was fine, and cleared the newly-surfaced finding as
future-proofing to stay consistent. That is exactly the anchoring the challenger exists to break.
The revision rule says decide each revision from ITS OWN review doc — which also means a later
revision's stronger review can legitimately reverse an earlier generous approve on an unchanged
property. R3/R4 stand (one row per revision, not retroactively rewritten), but they were slightly
generous on this specific property.

## Rule
- When a later revision's review surfaces a finding your earlier revisions missed, RE-DERIVE the
  severity from the code, not from "I already approved this." Consistency with your own past
  verdict is not evidence; the finding's trigger/blast-radius is.
- For a test-infrastructure PR, a false-green path in the harness's OWN self-verification (green
  while running/asserting nothing) undermines the stated purpose ⇒ OPEN_GAP, even if the trigger is
  a plausible future edit rather than a defect in the current tree. This is distinct from ordinary
  "incomplete coverage of unchanged production code" (which clears) — the difference is whether the
  gap defeats the thing the PR exists to provide.
- Corollary from the same PR: a per-option test that never reaches the option-sensitive code path
  (here `useFastAnalysis`: the undecorated callee makes `doesCalleeHaveSideEffect` return true, so
  `areCallArgumentsSideEffectFree(...,options)` is never reached) provides illusory coverage — a
  coverage-validity gap, not a mere comment-accuracy nit.

## Also (recurring)
Devin was head-stale a 3rd consecutive time on this PR (R3/R4/R5), citing pre-rename paths. On a
renamed tool, treat Devin as non-signal unless its cited paths match the head's file set.
