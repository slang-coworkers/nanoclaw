---
name: feedback_a_verdict_label_set_needs_an_unrelated_to_diff_slot
description: "INFRA / REAL / INDETERMINATE cannot express 'real crash, not attributable to the diff' — forcing it corrupts the verdict. Add UNRELATED-TO-DIFF carrying a reachability argument. Reachability is the only decisive leg; 'N siblings passed' is corroborating only (an input-specific defect in shared code spares siblings). Measured slang PR #12353, 2026-08-05."
metadata:
  type: feedback
---

# A CI-verdict label set needs an UNRELATED-TO-DIFF slot

Split out of [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] 2026-10-02.
Instance: slang PR #12353, `test-falcor / Test (Falcor)` on SLANGWIN4, exit `3221225477` =
`0xC0000005` host access violation, logs of the only prior failure (run `29742458336`, 2026-07-20)
expired.

## The label set

⭐⭐ **INFRA / REAL / INDETERMINATE had no slot for "a process genuinely crashed and the diff cannot
reach it."** Forced to REAL it implicates the maintainer's PR; forced to INFRA it blames the environment.
With a human watching a red X, the label is what gets acted on. ⇒ **A label set needs a slot for every
outcome the evidence can produce** — add **UNRELATED-TO-DIFF**, carrying its reachability argument.

⛔ I first wrote "not infra" as established — withdrawn: a host access violation on a Windows runner is
a *paradigm* infra suspect. Infra-vs-genuine-unrelated-defect was **undetermined**, which is exactly
why the fourth slot is needed: report *not-the-diff* without pretending to have resolved infra-vs-real.
Equally ⛔ **"known flake" was not established** (only prior failure's logs expired; no red-master
control). State the limit rather than let "probably flaky" ride on the reachability claim's strength.

## Which legs are decisive

- ⭐⭐ **Reachability is the only decisive kind, and here it had two independent legs:**
  (1) `createArtifactFromIR` opens with `SLANG_RETURN_ON_FAIL(emitSPIRVFromIR(...))`
  (`slang-emit.cpp:3291`) — SPIR-V-only by construction, so a D3D12/DXIL test never enters it. Cite the
  entry call (checkable in one read), not "the branch is SPIR-V flavored". (2) `slang-fixer`'s: both
  changed branches require `needsValidation` **and** a non-OK `validate`.
- ⛔⛔ **Sibling isolation is an overclaim.** I wrote that a regression "would not spare nine
  near-identical neighbours" (measured figure: 12 PASSED / 1 FAILED / 2 SKIPPED — "nine" was never
  measured). `slang-fixer` refuted it: **an input-specific defect in shared code can hit one variant and
  spare its siblings.** Isolation *localizes*; it does not exonerate. ⭐⭐⭐ "N siblings passed" feels
  strongest because the count is large — it is one weak inference repeated N times.
- Crash profile (access violation, not a golden-image mismatch) is likewise corroborating only.

⚠️ Attribution correction: I first recorded "I sent the sibling argument to both peers, who repeated
it back". Wrong — the fixer formed it independently (22:12:54, self-caught 22:15:15) before my message
(22:19:50). Two convergent origins, and I erred toward taking *more* blame, the direction I never
thought to verify ([[feedback_verified_fragments_do_not_verify_the_conclusion]]).
