---
title: "Approver merge-outcome calibration: agreement, disagreement, false-safe, over-conservatism"
type: concept
group: misc
tags: [slang-pr-approver, calibration, merge-join, false-abstain, false-safe, WOULD_APPROVE, ABSTAIN_POLICY, OPEN_GAP, process-label, doc-sync, test-gap]
source_count: 18
---

## TL;DR

These atoms are calibration *joins*: the approver's recorded decision matched (or
did not) the eventual human outcome (merge = APPROVED-equivalent, closed-unmerged =
REJECTED-equivalent), read at the exact decision commit. The load-bearing
discipline throughout is the **join-SHA rule**: before scoring a decision against
an outcome, diff decision-head vs merged/closed-head. Zero interval commits ⇒ the
human shipped exactly what you decided on; an interval fix commit ⇒ the human
agreed with your gap (it was addressed), not disagreed.

The strongest recurring miscalibration is **over-conservative abstaining**:

- **A missing regression test on PROVEN-correct code is ADVISORY (it ships), not
  OPEN_GAP.** Reserve OPEN_GAP/ABSTAIN for uncertainty about *current* correctness
  (a real input could be silently wrong now), never for forward-regression hygiene
  on code a sound from-source proof + clean production review + green CI already
  establish. Confirmed by multiple merges over the approver's abstain.
- **A pure repo-process/label finding filed under "## Bugs" must NOT ratchet into a
  forced BLOCK/abstain.** Classify it as a 🟡/🔵, not a 🔴, when it has zero
  code-correctness content — maintainers merge code-correct PRs and treat the label
  call as their own.
- **`ABSTAIN_POLICY` rows are excluded from agreement scoring** (author_trust /
  head_provenance abstains assert nothing about the code) — so a subsequent merge is
  NOT mineable as false-safe or human-disagreement. But on the *merits*, a clean
  read that later merges unchanged is a confirmed calibration data point.
- **closed-unmerged is NOT automatically agreement with your finding** — read the
  closing comment. Parent-issue re-scope, superseded-by-successor-PR, and author
  abandonment are orthogonal causes; over-claiming vindication mis-trains recall.

Confirmed *safe shapes* worth recalling at Step-0: conservative prove-then-apply
CFG passes with failure-sensitive positive controls; narrow producer-side type-
legalization fixes; crash→narrow-diagnostic-guard-before-mutation; doc-sync of a
byte-identical non-generated block; FileCheck anchor pass-name→position-regex
relabels; and bulk mechanical test-idiom migrations (risk lives in the ONE premise,
not the N repetitions).

## Over-conservatism: the test-gap-on-proven-correct-code miss

The clearest repeated calibration miss is abstaining `OPEN_GAP` on a *missing
regression test* for code whose correctness is already established. On #12616 the
approver abstained because a reachable interleaved-merge branch lacked a test and
its ordering guard was `#ifdef _DEBUG`-only; the maintainer approved and merged
as-is with no test added — the OPEN_GAP bar was mis-set for a two-pointer merge
proven over verified invariants
[missing regression test on proven-correct path is advisory](../learnings/1788280165772-approver-human-disagreement-a-missing-regression-t.md).
The same shape recurred on #12574: a *defensive guard* correct today, whose failure
would require a *future* regression, was held as OPEN_GAP — the discriminator is
"untested branch that could be SILENTLY WRONG on a real input NOW" (legitimately
abstain-worthy) versus "untested defensive guard all signals confirm correct"
(advisory-clear)
[false-abstain on missing test for correct code](../learnings/1788281996872-approver-human-disagreement-false-abstain-i-abstai.md).

## Process/label findings that force a false abstain

A second recurring miss: Devin/CodeRabbit file repo-process observations
(breaking-change label, missing CONTRIBUTING.md doc entry) under "## Bugs", and the
doc-🔴 guardrail ("investigation can never clear a doc-🔴") mechanically forces an
abstain on PRs maintainers happily merge. On #12503 the sole active finding was a
`pr: breaking change` label question about removing a `__`-prefixed intrinsic that
only ever crashed; the maintainer merged unchanged with `non-breaking`
[repo-process/label finding forces abstain](../learnings/1788232705503-approver-human-disagreement-a-repo-process-label-f.md),
confirmed by the merge join
[#12503 shipped unchanged at the ABSTAIN'd head](../learnings/1788260622320-approver-human-disagreement-confirmed-by-merge-125.md).
Likewise a verified CONTRIBUTING.md doc-omission for a niche self-documenting
diagnostic (E55216) is at most advisory — #12378 merged with zero docs touched
[doc-omission for niche diagnostic not merge-blocking](../learnings/1788247059345-approver-human-disagreement-a-verified-contributin.md).
The fix: at synthesis, classify a pure process/label observation with zero
code-correctness content as a 🟡 gap / 🔵 question (clearable via the
conservative-lean bar), never a 🔴 — but never down-classify a real code 🔴.

## Verified defects that still ship, and reachability before BLOCK

Even a *verified* 🔴 is not automatically block-worthy. On #12186 the approver
reproduced a real ICE (`TextureBuffer<T>.Handle` under spvBindlessTextureNV), yet
both maintainers approved and merged it shipping the ICE — because the trigger is a
niche, *already-broken* edge, not a mainline path the PR regressed. Severity-grade
first: establish support status and test the trigger *without* the PR's change;
ICE-on-supported-path ≫ ICE-on-niche-already-broken-path
[verified ICE on niche/already-broken trigger ships](../learnings/1788368010791-approver-human-disagreement-verified-ice-on-a-nich.md).
Conversely, R1 BLOCK on an emit null-deref that shipped `:843` unchanged was a
confirmed FALSE BLOCK — an interface-lowering pass strips the type before the
C-family emitter sees it, so the consumer is never reached; prove the emit site is
REACHED before inheriting a review's 🔴 severity
[merged-unchanged vindicates prove-reachability-before-BLOCK](../learnings/1788260653258-approver-confirmed-hit-merged-unchanged-vindicates.md).

## closed-unmerged is not vindication of your gap

A `Part of #<issue>` PR (#12649) that the approver abstained OPEN_GAP on closed
unmerged — but the closing comment showed the *parent issue was re-scoped* and the
approach superseded (#12841/#12842), orthogonal to the coverage gap. Separate the
host's outcome mapping (closed = REJECTED-equivalent) from the CAUSE (read the
closing comment); record "abstain was safe; close was a design re-scope" rather
than "gap confirmed"
[closed-unmerged for re-scope is not gap vindication](../learnings/1788207291438-approver-human-disagreement-a-part-of-issue-pr-can.md).

## Abstains excluded from scoring; merits reads still confirmable

Bot/CONTRIBUTOR author_trust and fork head_provenance abstains are excluded from
agreement scoring because they assert nothing about the code. But when such a PR
merges unchanged, the *merits* read (recorded as a non-gating challenger note) is
confirmed: a conservative prove-then-apply jump-threading CFG pass
[CFG jump-threading merged clean](../learnings/1788204320127-approver-human-agreement-confirmed-safe-conservati.md);
a crash→narrow-diagnostic-guard-before-mutation in the torch binding pass
[crash→narrow-diagnostic-guard shape merged unchanged](../learnings/1788280141539-approver-human-agreement-confirmed-safe-crash-narr.md);
a swizzled-lvalue fix from a frequent fork contributor
[frequent fork contributor PR merged unchanged](../learnings/1788264216124-approver-human-agreement-frequent-fork-contributor.md);
and #12517 where R1 WOULD_APPROVE was vindicated while R2's abstain was a
lost-mount false-abstain
[R1 vindicated, R2 lost-mount false-abstain](../learnings/1788266083934-approver-human-agreement-slang-12517-merged-r1-wou.md).

Two checks keep "merged ⇒ APPROVED-equivalent" from misleading you when the
`pr_merged` join lands on a large MEMBER/OWNER-authored feature PR that abstained.
First, verify whether an INDEPENDENT (non-author, non-bot) human actually reviewed —
filter `reviews[]` of the author and bots; on #12859 (experimental numeric interface
modules, ABSTAIN'd on all 5 heads for `no_protected_paths` (a `**/CMakeLists.txt`
edit) + `tier_eligible` (~9k lines / 41–43 files)) that set was `[]`, so the merge
was the author-maintainer self-merging a green-CI feature on their own confidence,
NOT a second human validating the code. Second, the delta between your last-decided
head and the merged head can be a routine `Merge branch 'master'` (spvdb vendoring,
unrelated fixes), not review churn — separate feature-substantive commits from master
merges before drawing any "what humans changed" lesson (the numerics feature itself
was stable across all 5 revisions). This class is a standing routing cost (rows
excluded from scoring), not a false-safe; a tiered mount that raised the caps and
exempted standard-module `CMakeLists.txt` for trusted authors with green CI would make
it *decidable* instead of contributing only excluded-from-scoring abstains
[merged-after-abstain: what the merge join actually means on a large maintainer feature PR](../learnings/1788973325106-approver-human-disagreement-merged-after-abstain-l.md).

## Confirmed safe shapes and mechanical-migration risk

Several atoms record *confirmed-safe* PR shapes and where to spend review budget. A
doc-sync PR whose sole change is a byte-identical copy of a non-generated
source-of-truth block is a low-risk WOULD_APPROVE — confirmed by an explicit
maintainer APPROVE
[doc-sync byte-identical block WOULD_APPROVE](../learnings/1788204396489-approver-human-agreement-confirmed-doc-sync-would-.md).
A FileCheck anchor relabel (pass-name → position-regex) is safe when the positive
checks are byte-identical, non-vacuity is demonstrable, and the bundle is complete
[FileCheck anchor pass-name→position-regex relabel](../learnings/1788163738892-approver-human-agreement-filecheck-anchor-pass-nam.md).
For a bulk mechanical test-idiom migration across a generated corpus, the N edits
carry almost no independent risk — verify the ONE behavioral premise in source and
don't inflate a residual clarity nit
[bulk mechanical migration: verify the one premise](../learnings/1788162629546-approver-human-agreement-bulk-mechanical-test-idio.md).
And a large automated upstream/branch-sync PR that is a strict descendant is a
distinct low-risk class where the `tier_eligible` abstain is correct routing but
the outcome is near-certainly APPROVE
[large bot sync merged unchanged, size cap conservative](../learnings/1788149356054-approver-human-agreement-large-bot-upstream-sync-m.md).

**Source learnings (18):**

- [Large bot upstream-sync merged unchanged after tier_eligible abstain](../learnings/1788149356054-approver-human-agreement-large-bot-upstream-sync-m.md) — nanoclaw#1391 (8588 churn) merged clean; sync-bot strict-descendant PRs are their own low-risk class; the 8000 line cap is conservative for it.
- [Bulk mechanical test-idiom migration merged as-is](../learnings/1788162629546-approver-human-agreement-bulk-mechanical-test-idio.md) — #12846 (972-file `-o /dev/null`→`-o -`); risk lives in the one stream premise, not the repetitions; a residual stale-prose nit that merges confirms a low-severity call.
- [FileCheck anchor pass-name→position-regex relabel merges as-is](../learnings/1788163738892-approver-human-agreement-filecheck-anchor-pass-nam.md) — #12809; safe when positive checks are byte-identical, non-vacuity provable (a real red run), and the bundle complete.
- [Conservative prove-then-apply CFG pass (jump-threading) merged clean](../learnings/1788204320127-approver-human-agreement-confirmed-safe-conservati.md) — #12795; safe-by-construction shape: all-or-nothing, join-preserving, bails to missed-opt not miscompile, ships a failure-sensitive positive control + one decline per gate.
- [doc-sync WOULD_APPROVE (#12584) merged with explicit human APPROVE](../learnings/1788204396489-approver-human-agreement-confirmed-doc-sync-would-.md) — byte-identity-at-fetched-head + not-generated + scope-vs-issue confirmed against a real APPROVE; don't over-abstain this shape.
- [A "Part of #<issue>" PR can close unmerged for an upstream re-scope](../learnings/1788207291438-approver-human-disagreement-a-part-of-issue-pr-can.md) — #12649; read the closing comment before treating closed-unmerged as vindication; record cause (re-scope) separate from outcome mapping.
- [A repo-process/label finding classified as "Bug" forces ABSTAIN on code-correct PRs](../learnings/1788232705503-approver-human-disagreement-a-repo-process-label-f.md) — #12503 R2; slang breaking-change rule; classify a pure label observation as 🟡/🔵, not 🔴, when it has zero code-correctness content.
- [A verified CONTRIBUTING.md doc-omission for a niche diagnostic is not merge-blocking](../learnings/1788247059345-approver-human-disagreement-a-verified-contributin.md) — #12378 (E55216) merged with zero docs; weight it advisory, not a forced BLOCK; test-falcor red didn't block.
- [#12503 shipped UNCHANGED at the exact ABSTAIN'd head](../learnings/1788260622320-approver-human-disagreement-confirmed-by-merge-125.md) — closes the loop: process-label-only abstains are over-conservative; synthesize such findings as 🟡/🔵 so a verified-clean fix can reach WOULD_APPROVE.
- [merged-unchanged vindicates the prove-emit-reachability-before-BLOCK check](../learnings/1788260653258-approver-confirmed-hit-merged-unchanged-vindicates.md) — #12819; R1 BLOCK on :843 null-deref was a confirmed FALSE BLOCK (lowering strips the interface type before emit); R2 WOULD_APPROVE confirmed.
- [Frequent fork contributors deterministically abstain on provenance — expected](../learnings/1788264216124-approver-human-agreement-frequent-fork-contributor.md) — #12769 merged unchanged; ABSTAIN_POLICY excluded from scoring; don't mine the merge as false-safe or disagreement.
- [#12517 merged: R1 WOULD_APPROVE vindicated; R2 ABSTAIN was a lost-mount false-abstain](../learnings/1788266083934-approver-human-agreement-slang-12517-merged-r1-wou.md) — tag rows `policy-mount-lost (pending operator confirm)`; materialize-at-r-value-consumer via getSimpleVal is the mergeable layer.
- [Confirmed safe: crash→narrow-diagnostic-guard shape merged unchanged (#12514)](../learnings/1788280141539-approver-human-agreement-confirmed-safe-crash-narr.md) — guard gated on a no-op-for-valid-input predicate, before any IR mutation, plus a positive-control diagnostic test; the challenger's whole job is confirming those three.
- [A missing regression test on a PROVEN-correct reachable path is advisory, not OPEN_GAP](../learnings/1788280165772-approver-human-disagreement-a-missing-regression-t.md) — #12616 merged over the abstain; separate "is it correct?" (proof: yes) from "is the branch tested?" (no); a proof stands in for a branch-level test.
- [FALSE-ABSTAIN: abstained OPEN_GAP on a missing test for correct code](../learnings/1788281996872-approver-human-disagreement-false-abstain-i-abstai.md) — #12574 merged over the abstain; discriminator: silently-wrong-now (abstain) vs future-regression-of-a-correct-guard (advisory-clear).
- [CONFIRMED-CORRECT abstain: one-arm emit fix closed & replaced by all-arms fix](../learnings/1788285548503-approver-human-disagreement-confirmed-correct-abst.md) — #12733 (one BitCast arm) closed unmerged, replaced by #12741 (all 3 arms); treat "siblings unguarded, title claims general fix" as OPEN_GAP unless every sibling is proven unreachable.
- [Verified 🔴 ICE on a niche/already-broken trigger: severity-grade before BLOCK](../learnings/1788368010791-approver-human-disagreement-verified-ice-on-a-nich.md) — #12186 shipped the ICE; establish trigger support status + test-without-the-change; recommend a tracking issue since an untracked shipped ICE has no breadcrumb.
- [Merged-after-abstain on a large maintainer feature PR: what the merge join actually means](../learnings/1788973325106-approver-human-disagreement-merged-after-abstain-l.md) — #12859 (numeric interface modules) self-merged with zero independent review; verify (a) independent-human-review vs author self-merge and (b) feature churn vs a routine master-merge before reading a merge as code validation.
