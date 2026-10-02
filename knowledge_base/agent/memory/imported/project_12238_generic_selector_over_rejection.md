---
name: project_12238_generic_selector_over_rejection
description: "TERMINAL (merged 2026-08-04). PR #12246's E30607 also rejects a generic/associated/struct switch selector, including `T : IInteger`. The approver's ABSTAIN_POLICY:OPEN_GAP was booked as a MISS: the PR merged unchanged and nobody addressed that class. Lessons: severity is not existence; a refuted 'clear' means re-derive, not withhold; grep the test corpus for intent prose before building a compiler."
metadata:
  node_type: memory
  type: project
  tags:
    - slang
    - 12238
    - 12246
    - switch
    - generics
    - approver
    - calibration
  originSessionId: 7c60dd16-8d5c-4bb3-b934-5056a88a40a4
---

# #12238 / PR #12246: E30607 over-rejects a generic-typed switch selector

**TERMINAL.** PR #12246 was merged unchanged on 2026-08-04 12:15Z by skiminki-nv (merge commit
`645ac5eef2b1`, +39/−1, 3 files). After the decision there were no reviews, no comments and no review
threads. The `slang-pr-approver` ledger row `(shader-slang/slang, 12246, f3b5b511886d)` (mode
`live_late`, policy `v0-shadow-relaxed`, Devin-only source) recorded **ABSTAIN_POLICY / `OPEN_GAP`**.
That **joins as human disagreement, i.e. a miss**, not a clean withhold. Nothing was posted to GitHub.
Distilled 2026-10-01.

## The finding (true, verified by two tiers on two binaries)

The PR replaces a `TODO(tfoley)` in `visitSwitchStmt` (`slang-check-stmt.cpp`) with an early reject
whenever `!isValidCompileTimeConstantType(conditionType)`. That predicate (`slang-check-decl.cpp`) is
`isScalarIntegerType(type) || isEnumType(type)`, and both checks are keyed on **representation**
(`as<BasicExpressionType>` / `as<EnumDecl>`). A generic parameter `T` is a `DeclRefType` over a
`GenericTypeParamDecl`, so both branches are false and E30607 fires, **even for `T : IInteger`**. The
same happens for an associated type or a struct. The checker type-checks a generic body at its
definition site, before specialization, so the conformance is never consulted. The rejection is
architecturally consistent *and* too broad. The real design choice was between consulting
conformances at the check and deferring the check until specialization.

Main's corroboration used the pre-existing `build/Release/bin/slangc` as a pre-PR baseline. That
baseline was confirmed by the absence of `SwitchConditionNotInteger` in the tree and of the message
string in `strings` output, with a non-zero control. On that baseline, a `default:`-only generic
switch compiles **and emits both the selector call and the default body**. So the construct is not a
no-op.

Cosmetic side-finding: the predicate also accepts `bool` (the #12237 accept-and-legalize carve-out),
but the message says "integer or enum". This errs on the permissive side, so no shader is rejected
with a wrong explanation. ⭐ A `file:line` cite only holds for one commit: a cite into lines the PR
*adds* lands on unrelated content in a pre-PR tree. Pair line numbers with the symbol name.

## Why the abstain was a miss

csyonghe had **approved at this exact head**, which settled the reject-vs-coerce design choice. The
abstain rested on a new edge case the approver found itself, which was never discussed on the PR. All
the measurements held. **The gap existed, but it did not matter to the decision.** The approver's own
severity scale, filed as the correction:

| tier | shape | disposition |
|---|---|---|
| (a) | already failed **pre-PR**, so not a regression | not a finding |
| (b) | compiles today but degenerate | advisory, and name the follow-up |
| (c) | compiles today, a sane pattern, plausibly shipped | `OPEN_GAP` |

It filed the whole class as (c). It was mostly (a) and (b):

- **(a), verified by Main in one compile:** a generic switch with an integer `case` label *already*
  failed before the PR (`E30019 type mismatch … expected 'T', got 'int'`). Only the case-less
  remainder survives.
- **Corpus sweep:** 184 switch sites in `tests/` + `source/slang/`. Only 2 have no `case` label, both
  in `tests/bugs/empty-switch.slang` and both with `int` selectors, which the predicate still accepts.
  **Zero instances of the newly rejected class.**
- Things the approver underweighted: the PR's *purpose* was to narrow, and it already carried
  `pr: breaking change`. The fact that an edge case went undiscussed **raises a question but carries
  no severity**. What survives: an approval of the intended change is not sign-off on an unintended one.

⭐⭐⭐ **A refuted "clear" does not mean "withhold". It means re-derive.** DECISION_REVIEW correctly
refuted the "semantic no-op" premise. The approver then swung to the most conservative choice instead
of re-running the severity tiers on the corrected facts. The second judgement, made while correcting
the first, is where the failure was ([[feedback_a_phantom_correction_deletes_true_evidence]]). It
declined to cite its own "abstain on an open fork, then merged, counts as a clean withhold" precedent,
because here the fork was already resolved. That refusal is what makes the calibration ledger useful.

## The answer was already in the repo

`tests/bugs/empty-switch.slang:17-18` says: *"This is kind of silly - but it is a valid construct. We
want to check condition expression is executed though"* (`switch (++a) { }`). Its `.expected.txt`
contains **`1 2 3 4`** under `COMPARE_COMPUTE_EX` on `-slang`, `-vk`, `-cpu` and `-cuda`. That output
is only possible if the case-less switch's selector **is** evaluated and the statement before the
first case **is not**. So this is a maintainer claim the test machine keeps true on four backends.
⚠️ **Scope:** the test's selector is `int`, so it establishes that the construct is valid and the
selector runs. It is **silent** about whether the generic case is an intended, shipped pattern.

⭐⭐⭐ **Use the right instrument, not just the most rigorous one.** `git grep -lEi "valid construct"
-- 'tests/**/*.slang'` took **0.031 s**, against a ~40-minute compiler build. Both tiers searched the
corpus for **shapes** (switch sites, `default:`-only forms) and never for **intent prose** about the
shape. Those are two different queries; each tier ran one and believed it had searched. The ladder,
now filed:
(1) grep test comments for intent language → (2) find an executable assertion and its expected data →
(3) check whether the shape already fails before the change → (4) only then build the changed
compiler. Both tiers did (4) first, then (3). This is "search the store before deriving" with the
target swapped to the repo's own tests. When a rule has a target, list every target it applies to.

## Smaller process lessons

- **An unmeasured premise inside careful work is the one to attack.** The approver's tell: *"every
  other claim cited a file:line or a command; that one cited nothing."* Rigour on the surrounding
  claims built false confidence in the uncited one. Main made the mirror-image mistake the same
  afternoon ([[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]).
- **When a predicate covers every input with plain casts, reading it beats running it.** The two
  `as<>` casts settle the finding by inspection. The build still earned its place, because it produced
  the emit showing the switch isn't a no-op.
- **Name the scope of any count.** "0 of 196" counted only `default:`-only switches, which is
  narrower than the class.
- Main credited the approver's probes by Main's own `/tmp` names (`sx2`/`sx3`; the approver's were
  `sx1`/`sx2`): [[feedback_never_cite_a_peers_artifact_by_your_own_local_name]].
- Cost: one human glance not taken, ~2h spent with no effect, nothing posted. Over-abstaining is still
  cheaper than a false "safe", but this one is **booked as a miss** anyway.

Related: [[project_12238_float_switch_condition_invalid_spirv]] ·
[[project_12237_bool_switch_spirv_assert]] · [[project_9999_switch_without_cases_diagnostic_fork]] ·
[[feedback_approver_never_posts_route_reviewer]]
