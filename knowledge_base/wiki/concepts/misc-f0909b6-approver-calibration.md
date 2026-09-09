---
title: Approver Severity Calibration from Human-Outcome Joins
type: concept
group: misc
tags: [approver, calibration, open-gap, abstain, would-approve, merge-outcome, synchronize, docs-pr]
source_count: 18
---

## TL;DR

The shadow PR-approver records WOULD_APPROVE / ABSTAIN_POLICY(OPEN_GAP) / BLOCK, then the human
merge outcome is joined automatically host-side. These atoms are the calibration signal from those
joins — where an abstain was vindicated, over-cautious, or a "safe change class" shipped unchanged.

Recurring calibration rules that emerged:

- **Score against the falsifiable reading** — "material enough NOT to merge as-is", never the
  un-falsifiable "a human must look." A clean merge at your exact decided head REFUTES an abstain.
- **Real defect ≠ material enough to withhold.** Materiality is set by the artifact's consumers
  (the merge gate + reviewers), not by the abstract severity of the wrong data.
- **Latent vs live blast radius.** A gap confined to things the pipeline never executes (unrun test
  suites, dead code, a tool's own future self-check) leans CLEAR-with-advisory, not OPEN_GAP.
- **"No harness to verify X" is only abstain-worthy when X is otherwise unresolved.** When
  sibling-impl parity + platform gating + green CI on the affected tests + human approval already
  answer it, the missing harness adds no information.
- **A defensible deferral is still an open gap** — "the naive fix would regress, so they tracked it"
  explains WHY it's unfixed, not that the runtime behavior is cleared.
- **A merge-readiness self-declaration in the PR body** (or an unresolved design question) is a
  different axis from code quality; nit-fix / greener-review commits don't clear it.
- **Docs-only ≠ automatically out-of-scope OR automatically safe.** A docs PR on the in-domain repo
  is reviewed on merits (verify every claim at source); OUT_OF_SCOPE fires on repo-class / COI.

Safe change classes that merged unchanged (predictive priors for Step-0 recall): loosening only
FileCheck *scaffolding* while the claim-subject stays tight; hoisting a type out of a feature
`#ifdef` (6 conditions); an ELF version-script export allow-list with a silent-drop fallback; an
interim compile-time diagnostic guard mirroring a merged sibling; a docs prose-accuracy fix whose
every claim is source-verified.

## Vindication and over-caution: what the joins taught

Two joins vindicated an abstain. On slang#11118 a fail-OPEN depth cap (returned "copyable" at the
nesting limit, risking invalid SPIR-V) drew an OPEN_GAP; the author flipped it to fail-CLOSED
unprompted in the next revision, with a comment documenting exactly the flagged reasoning — the
"vindication pattern," where a false-safe the author fixes without any human "request changes"
confirms the gap was real ([detection vindicated: a fail-open depth cap fixed in the next
revision](../learnings/1787558627956-approver-human-disagreement-detection-vindicated-a.md)).
On slang#11387 a human CHANGES_REQUESTED landed on the exact residual an abstain had named — but
because SKILL rules exclude ABSTAIN rows from agreement scoring, that is *corroboration*, not a
scored agreement ([Human CHANGES_REQUESTED confirmed a prior
OPEN_GAP](../learnings/1787580499467-approver-human-agreement-human-changes-requested-c.md)).

Several joins exposed over-caution. On slang-rhi#770 a REUSE copyright *holder*-vs-author mismatch
that kept `reuse lint` green and had the License-Identifier right was treated as OPEN_GAP; an
independent human APPROVED and merged with the gap intact. The "fix CodeRabbit review" interval
commit fixed exactly the nits cleared-advisory and skipped the blocked one — a labeled signal the
severity ordering was inverted for that class ([slang-rhi maintainers merged past a REUSE
holder-accuracy OPEN_GAP](../learnings/1787558430570-approver-human-disagreement-slang-rhi-maintainers-.md)).
On slang#12593 the challenger had already concluded a Devin 🔴 was spurious (sibling-tool parity,
platform gating, green CI, human approval) yet abstained anyway on "no Windows+NVAPI harness"; the
merge-unchanged outcome showed that residual doubt carried no risk — when the narrative says
"spurious" but the reason_code says "CONCERN," the reason_code is the over-cautious one
([false-abstain on #12593](../learnings/1787617815926-approver-human-disagreement-false-abstain-on-12593.md)).
On slang#12727 an abstain on 3 stale tests in a companion suite *no CI job runs* was overruled by a
clean merge — the sharp rule is **executed vs never-executed**: classify a gap whose entire blast
radius is unrun suites / dead code / unreferenced fixtures as *latent*, and weigh latent gaps toward
not-material ([ABSTAIN on stale-tests-in-an-unrun-suite
overruled](../learnings/1787661102537-approver-human-disagreement-abstain-on-stale-tests.md)).
On slang#12347 a *future-trigger-only* self-verification hole in additive test infra (a partial
de-registration that hasn't happened, blast radius bounded to the tool's own monitoring) was
merged as a follow-up nit — distinguish it from a gap with a CURRENT trigger on the supported path,
which was worth blocking and got fixed ([a maintainer merged a test-infra PR over my OPEN_GAP
abstain](../learnings/1787695609676-approver-human-disagreement-a-maintainer-merged-a-.md)).

## Gaps that correctly held the line

Momentum ("they fixed everything else, wave the survivor through") is the pull to resist. On
slang#11225 the author fixed every actionable finding across four revisions but one spirv-extension
silent-drop remained; a defensible deferral to a tracked issue explains WHY it's open but doesn't
clear the live behavior — grade the behavior at the head, not the elegance of the deferral
([a DEFENSIBLE deferral of a hard-to-fix gap is still an
OPEN_GAP](../learnings/1787628734415-approver-challenger-calibration-a-defensible-defer.md)).
On slang#12665 a more-principled root-cause rewrite (fix the producer, add `CoopVectorType` to
`isValueType`) still abstained because it fixed only ONE member of a two-member type family
(`CoopMatrixType` reaches the same failure path), shipped GPU-only tests for a compile-time fix, and
had an open maintainer request — "more principled" and "code is correct" do NOT imply WOULD_APPROVE
([a more-principled root-cause rewrite can still ABSTAIN — probe the
type-FAMILY](../learnings/1787674136717-approver-challenger-calibration-a-more-principled-.md)).
On PR #12577 a merge-readiness self-declaration ("Prototype, not for merge as it stands") in the PR
*body* stayed the blocker across a synchronize whose commits fixed only review nits — a greener
review moves the code-quality axis, never the merge-readiness axis; carry the prior decisive concern
forward as an explicit checklist item ([nit-fix commits don't clear a persisting merge-readiness
ABSTAIN](../learnings/1787736150645-approver-human-disagreement-re-gating-a-synchroniz.md)).

## Safe change classes (Step-0 priors) and synchronize discipline

Confirmed-safe shapes that merged unchanged at the exact decided head:

- **Loosening only FileCheck scaffolding** (declaration specifiers/qualifiers) while the
  claim-carrying *subject* token stays tight is harmless; loosening the *subject* (dropping `*`/`&`,
  wildcarding the opcode under test) is rule-6 weakening → ABSTAIN. "Loosen the scaffolding, never
  the subject" ([test-hygiene PR loosening only declaration
  specifiers](../learnings/1787571116035-approver-human-agreement-confirmed-safe-test-hygie.md)).
- **Hoisting a type/symbol out of a feature `#ifdef`** is safe with all six of: single definition,
  no SDK collision in the guarded config (read the SDK header), deps in scope at the new location,
  still-gated users after the re-opened guard, in-file precedent, and a value-discriminating
  trigger-present control ([CUDA-prelude type-hoist out of a feature
  #ifdef](../learnings/1787605859666-approver-human-agreement-cuda-prelude-type-hoist-o.md)).
- **An ELF `--version-script` export allow-list** is low-risk when it's an explicit name list (not
  a prefix wildcard), every listed name has a definition and every `dlsym` site is covered, and the
  flag routes through `check_linker_flag` (silent-drop fallback = worst case is status-quo). A green
  CI check proves only what it BUILT — the wasm job doesn't link the glslang module
  ([symbol-visibility version-script
  hardening](../learnings/1787605941441-approver-confirmed-safe-symbol-visibility-version-.md)).
- **An interim compile-time diagnostic guard** (`static_assert(!__isHalf<T>())` in a `case cuda:`
  arm) mirroring a merged sibling is safe when the predicate folds per-specialization, each width is
  in its own recognized DIAGNOSTIC_TEST, and CI is green at the settled head; an imprecise doc/comment
  nit on an otherwise-correct guard is correctly advisory-not-blocking ([interim CUDA half-texture
  SampleLevel diagnostic guard](../learnings/1787623007634-approver-confirmed-safe-join-confirmed-interim-cud.md)).
- **A docs prose-accuracy fix** merges as-is when the diff is prose only, every factual assertion is
  source-verified at the head, scope matches the issue's request, and the bot review is clean AND
  your own read confirms accuracy (a tool + its own restatement are ONE signal)
  ([docs-only prose-correction PR](../learnings/1787695591387-approver-human-agreement-docs-only-prose-correctio.md)).
- **A `[[deprecated]]` attribute on a public COM/vtable method** is ABI+source-compatible
  (`pr: non-breaking`) when all four hold: the diff ONLY prepends the attribute (vtable slot,
  signature, `SLANG_MCALL`, declaration order all unchanged — a diagnostic attribute is not part
  of the vtable); every warning-producing USE is suppressed (`-Wdeprecated-declarations` fires on
  USES *through the base-interface pointer*, NOT on override declarations/definitions or a
  `&Derived::method`, so only a base-typed call needs a `SLANG_ALLOW_DEPRECATED_BEGIN/END` wrap);
  there is an existing precedent on the *same* interface to mirror (match the sibling exactly,
  don't diverge, e.g. `SLANG_DEPRECATED` vs raw `[[deprecated]]`); and scope matches the stated
  purpose. Blocking discriminator: a gap in the PR's *self-declared* mechanism (the warning never
  fires, the wrap missed a real base-typed call, the vtable actually moved) is a withhold; an
  *incidental* pre-existing inconsistency the PR neither introduces nor worsens is ADVISORY, not
  OPEN_GAP (slang#12610, merged unchanged; Devin-only tier — harvest exit 20 is expected on
  bot-authored PRs) [[approver/safe-shape] COM-interface method deprecation — the ABI-safe pattern and its blocking discriminator](../learnings/1787105470326-approver-safe-shape-com-interface-method-deprecati.md).
- **A canonical-data-table value flip that makes a compile-time member AGREE with an
  already-shipped classification on a separate path** is low-risk and merges unchanged (slang#12576:
  `kDynamicResourceCastableTypes` RO-buffer rows `"ReadWrite"`→`"RasterizerOrdered"` so
  `descriptorAccess` matches what `spReflectionType_GetResourceAccess` already returns and what RO
  *textures* already report). The safety argument: the table is the *sole* producer of the member
  (no second representation, no consumer patched to compensate); behavioral neutrality is provable
  (the only branch on the member is `Read == descriptorAccess`, and both old and new values take the
  identical non-Read else-path, so bindless lowering is byte-unchanged); and the regression test
  asserts the exact changed values with the table change verified *complete*. The decisive
  corroboration for a "make surface A agree with surface B" claim is to confirm B independently —
  grep the reflection switch / the analogous types; if B already reports the new value it is a
  convergence, not a new semantic, and the blast radius is just direct member readers
  [[approver/calibration] Member↔reflection descriptorAccess consistency fix (data-table value flip) merged unchanged — clean CodeRabbit+Devin signal predicted it](../learnings/1788272159041-approver-calibration-member-reflection-descriptora.md).

On a synchronize after prior approval, **decide on the PR's OWN diff, never the head-to-head
`compare` interval** (which is dominated by unrelated master-merge churn); isolate the
PR-authored delta by sha256-comparing its files across the two heads. A DISMISSED prior approval is
`live_late`, not `live`; and DISMISSED ≠ RETRACTED — prove stale-on-push from the
`dismissed_review.dismissal_commit_id` (nested) field plus a same-timestamp force-push, and re-pull
CI at the new head (a synchronize can turn an in-progress caveat into settled green)
([decide on the PR's own diff; DISMISSED ≠
RETRACTED](../learnings/1787606331815-approver-confirmed-safe-on-a-synchronize-after-pri.md)).
Finally, OUT_OF_SCOPE is a *repo-class* (non-compiler fork) or *conflict-of-interest* (changed
paths ARE the approver's harness/policy) predicate — NOT "it's documentation." A docs-accuracy PR on
`shader-slang/slang` itself is in-domain and decided on merits ([a docs-only PR ON shader-slang/slang
itself is IN-scope](../learnings/1787706539641-approver-clause-gap-a-docs-only-pr-on-shader-slang.md)).

**Source learnings (18):**
- [slang-rhi maintainers merged past a REUSE holder-accuracy OPEN_GAP](../learnings/1787558430570-approver-human-disagreement-slang-rhi-maintainers-.md) — holder ≠ merge-blocker when lint is green; a "fix CodeRabbit" interval commit is a labeled calibration signal.
- [detection vindicated: a fail-open depth cap fixed in the next revision](../learnings/1787558627956-approver-human-disagreement-detection-vindicated-a.md) — author flipping a false-safe to fail-closed unprompted confirms the gap was real.
- [CONFIRMED-SAFE: test-hygiene PR loosening only declaration specifiers](../learnings/1787571116035-approver-human-agreement-confirmed-safe-test-hygie.md) — loosen the scaffolding, never the claim-carrying subject.
- [Human CHANGES_REQUESTED confirmed a prior OPEN_GAP](../learnings/1787580499467-approver-human-agreement-human-changes-requested-c.md) — a master-merge synchronize carries no fix delta; a dropped [draft] label can hide a hard human block.
- [CUDA-prelude type-hoist out of a feature #ifdef merged as-is](../learnings/1787605859666-approver-human-agreement-cuda-prelude-type-hoist-o.md) — six conditions that make a "move out of guard" PR safe.
- [Symbol-visibility version-script hardening merged unchanged](../learnings/1787605941441-approver-confirmed-safe-symbol-visibility-version-.md) — allow-list + silent-drop fallback = low-risk class; green CI proves only what it built.
- [On a synchronize after prior approval: decide on the PR's own diff](../learnings/1787606331815-approver-confirmed-safe-on-a-synchronize-after-pri.md) — DISMISSED is live_late and ≠ RETRACTED; re-pull CI at the new head.
- [False-abstain on #12593](../learnings/1787617815926-approver-human-disagreement-false-abstain-on-12593.md) — "no harness to verify" is not abstain-worthy once convergent evidence resolves the concern.
- [JOIN confirmed: interim CUDA half-texture SampleLevel diagnostic guard](../learnings/1787623007634-approver-confirmed-safe-join-confirmed-interim-cud.md) — per-specialization fold + merged-sibling precedent → WOULD_APPROVE well-calibrated.
- [A DEFENSIBLE deferral of a hard-to-fix gap is still an OPEN_GAP](../learnings/1787628734415-approver-challenger-calibration-a-defensible-defer.md) — defensible-to-defer and cleared are different axes; a clean-up streak doesn't round up the survivor.
- [ABSTAIN on stale-tests-in-an-unrun-suite overruled by clean merge](../learnings/1787661102537-approver-human-disagreement-abstain-on-stale-tests.md) — latent (never-executed) vs live gap; classify by whether a workflow runs the artifact.
- [A more-principled root-cause rewrite can still ABSTAIN — probe the type-FAMILY](../learnings/1787674136717-approver-challenger-calibration-a-more-principled-.md) — a fix adding one sibling of a two-member type family is a partial fix of the bug class.
- [Docs-only prose-correction PR merged at my exact head](../learnings/1787695591387-approver-human-agreement-docs-only-prose-correctio.md) — four-condition safe-shape checklist for a documentation-accuracy PR.
- [A maintainer merged a test-infra PR over my OPEN_GAP abstain](../learnings/1787695609676-approver-human-disagreement-a-maintainer-merged-a-.md) — future-trigger-only self-verification hole in additive test infra leans clear-with-advisory.
- [A docs-only PR ON shader-slang/slang itself is IN-scope](../learnings/1787706539641-approver-clause-gap-a-docs-only-pr-on-shader-slang.md) — OUT_OF_SCOPE fires on repo-class / COI, not on "it's docs."
- [Re-gating a synchronize: nit-fix commits don't clear a merge-readiness ABSTAIN](../learnings/1787736150645-approver-human-disagreement-re-gating-a-synchroniz.md) — re-read the PR body self-declaration each revision; carry the prior concern forward.
- [deprecating a public COM/vtable method (slang#12610) is ABI-safe when the diff only prepends `[[deprecated]]`, every base-typed USE is suppressed, a same-interface precedent is mirrored, and scope matches; a self-declared-mechanism gap is a withhold, an incidental pre-existing inconsistency is advisory.](../learnings/1787105470326-approver-safe-shape-com-interface-method-deprecati.md)
- [a canonical-table value flip making a compile-time member agree with an already-shipped classification (slang#12576 `descriptorAccess`) is low-risk when the table is the sole producer, behavior is provably neutral, and surface B independently already reports the new value.](../learnings/1788272159041-approver-calibration-member-reflection-descriptora.md)
