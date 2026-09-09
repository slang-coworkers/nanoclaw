---
title: Approver outcome calibration — over-abstain, reason-family scoring, and confirmed-safe shapes
type: concept
group: misc
tags: [pr-approver, calibration, over-abstain, open-gap, would-approve, human-disagreement, reason-family, confirmed-safe]
source_count: 14
---

## TL;DR

Joining approver decisions against human merge outcomes produced a consistent
calibration signal: **abstains over-fire on nits, and the reason-family matters
more than the decision string.** Repeated over-abstains erode signal (the cheap
direction, but not free), so calibrate on these rules:

- **Score an ABSTAIN by its reason family, not "abstained ≠ merged."** A
  *policy-family* abstain (`author_trust`, protected-path, size/tier) that a
  human resolves by merging is the policy working as designed — record
  "confirmed safe" iff your informational challenger read matched the outcome.
  Only a *code-concern* abstain (`OPEN_GAP`, `CHALLENGER_CONCERN`) is scored
  against the falsifiable reading "material enough not to merge as-is," which a
  clean merge-unchanged refutes.
- **Reachability and surface gate OPEN_GAP.** A pre-existing latent defect that
  is inert on every *actually-invoked* path, or a fail-loud guard whose trigger
  is *internal and verified-unreachable*, clears as advisory — especially on
  internal ops/tooling surfaces. Reserve OPEN_GAP for a defect NEW-in-this-PR or
  reachable on a path something runs, or with an external/attacker-controlled
  trigger.
- **Resolve "introduced vs pre-existing" by reading the BASE** — it's a cheap,
  decidable question, not a reason to abstain.
- **Coverage/label nits clear on maintainer test-infra PRs.** Distinguish a gap
  that could *mask a wrong verdict* (blocking) from "add a test / fix a label"
  (advisory).

Confirmed-safe WOULD_APPROVE shapes that merged unchanged: doc-sync PRs
byte-identical to the fetched-head source; `.github/**` workflow tooling under
the wide policy; ABI-safe COM-deprecation; and `external/slang-rhi` ToT submodule
bumps under a 4-point control.

## Score by reason family, not by decision string

[The reason-family rule](../learnings/1786999539196-approver-human-disagreement-a-policy-abstain-resol.md)
(slang#12580, doc-only, `nv-slang-bot[bot]` author) is the frame that unifies the
disagreement cases. An `ABSTAIN_POLICY` splits into a **policy family**
(`author_trust`/protected-path/tier — asserts nothing about the code, only
"route to a human by rule") and a **code-concern family**
(`OPEN_GAP`/`CHALLENGER_CONCERN` — "there may be something in the code"). A clean
merge pressures only the second; for the first, the merge is a human taking over
as designed (`author_trust` is "never optimized toward zero"). The calibration
check for a policy-family abstain is whether your *informational* challenger read
agreed with the outcome, not the abstain-vs-merge string.

## Over-abstain on nits (the dominant miss)

Several joins show OPEN_GAP over-firing when the residual is a *nit*:

- [Test-infra coverage nits (slang#12471)](../learnings/1786976249687-approver-human-disagreement-abstain-open-gap-on-te.md):
  three coverage/clarity gaps (0 bugs from the reviewer, Devin clean) on a
  maintainer-authored test-tooling PR, merged unchanged. The maintainer merge bar
  treats *missing-positive-test* as advisory. Distinguish a gap that could **mask
  a wrong verdict** (blocking) from "add a test for completeness" (advisory).
- [Diagnostic-label + speculative masking window (slang#12573)](../learnings/1786978439947-approver-human-disagreement-over-abstain-a-diagnos.md):
  when the correctness question is answered (verdict provably intact on every
  realistic path) and only "*could* mislead / *narrow* window / *speculative*"
  remains, that is a nit that clears — "uncertainty ⇒ ABSTAIN" is for uncertainty
  about correctness/blast-radius, not a fully-understood minor-quality issue.
- [Pre-existing wrong-repo link on an ops dashboard (slang#12572)](../learnings/1787060182513-approver-human-disagreement-overruled-abstain-open.md):
  a CodeRabbit-escalated 🟠 Major that was inert on the only invoked path
  (`--repo` flag documented but nothing sets it). **"Documented/supported" ≠
  "exercised"** — grep every caller/cron for the flag; a config knob nothing sets
  is a latent trigger. Bot severity *escalation* on adjacent-line changes is a
  labeling artifact, not new reachability.
- [Fatal-but-verified-unreachable defensive assert (slang#12539)](../learnings/1787149751727-approver-human-disagreement-open-gap-on-a-fatal-bu.md):
  a `SLANG_RELEASE_ASSERT` whose trigger is *internal* (only fires if some other
  pass attaches an out-of-set attr, disproven by complete producer enumeration)
  clears as advisory. The discriminator vs a *vindicated* latent-BLOCK is
  **reachability + who controls the trigger**: internal+verified-unreachable →
  advisory; external/metadata-controlled → block-worthy. PR-rationale-vs-code
  contradiction and "two reviewers flagged it" are advisory signals, not blocks.

## Resolve introduced-vs-pre-existing by reading the base

[slang#12614 (Falcor CI)](../learnings/1787156940615-approver-human-disagreement-resolve-introduced-vs-.md)
crystallizes the recurring root cause: the approver *named* the deciding
uncertainty ("does the PR introduce the perf delay or merely leave it
pre-existing?") and abstained on it **instead of resolving it** with one read of
the base file (which showed the exposure pre-existing and unchanged). A condition
present in the base that the PR neither introduces nor worsens is advisory. This
is the general form behind the pre-existing-🔴 cases below.

## Pre-existing 🔴 vs the fallback-tier bar (procedure tension)

Two atoms document the same slang#12552 decision (contain exceptions escaping
`Module::precompileForTarget`): [the challenger-miss framing](../learnings/1787095789022-approver-challenger-miss-a-real-but-pre-existing-o.md)
establishes that a Devin 🔴 that is real-but-pre-existing on a path the PR
*strictly improves* (the old path terminated the process; the new path recovers)
resolves to CHALLENGER_CONCERN, not BLOCK. [The human-disagreement join](../learnings/1787112757529-approver-human-disagreement-abstain-on-a-pre-exist.md)
scores it: merged as-is by the twice-approving maintainer ⇒ the abstain
over-conserved — but it was the *ceiling available* under the absolute "never
upgrade past a 🔴" guard, so the disagreement points at the procedure, not the
application. Both propose letting a verified pre-existing/out-of-scope
determination downgrade a fallback 🔴 out of bar-territory. (This is the same
structural gap as the policy-clause page's refutation-state proposal.)

## The confirmed no-disagreement / red-on-arrival class

[slangpy#1112 (add cross-platform TSan workflow)](../learnings/1787004204123-approver-human-disagreement-confirmed-no-disagreem.md)
is the positive control: ABSTAIN(OPEN_GAP) on all three revisions citing the new
whole-repo lane being red-on-arrival, and the author self-closed unmerged ⇒
CONFIRMED match. The transferable class-signal: a PR adding a NEW whole-repo
sanitizer/analysis lane almost always fails its first run by surfacing *latent
pre-existing* issues, not diff defects. The real question for the human is the
**rollout strategy** (fix-first / suppressions / non-gating), and its absence is
the concrete OPEN_GAP.

## Confirmed-safe WOULD_APPROVE shapes

Four shapes merged unchanged at the decided head, validating their approve
templates:

- [Doc-sync PR byte-identical to the fetched-head source (slang#12584)](../learnings/1787061671880-approver-human-agreement-doc-sync-pr-is-a-safe-wou.md):
  documentation is a *consumer* of the mechanism, so the decision reduces to
  "does the doc now match the mechanism?" — three cheap probes: byte-diff the
  new block against the source at the fetched head; confirm the doc is
  hand-written not generated; confirm scope vs the issue.
- [`.github/**` workflow-tooling PR under the wide policy (slang#12579)](../learnings/1787111103294-approver-human-agreement-confirmed-a-clean-well-te.md):
  a stale Step-0 "protected-path is terminal" prior would have manufactured a
  false abstain, but `v0-shadow-wide` deliberately dropped `.github/**` from
  protected. When a Step-0 prior and the live clause script disagree, **the
  clause script wins**; the productive probe is "do the referenced helpers exist
  / does the unit test pass at head," not path-fear.
- [ABI-safe COM-deprecation (slang#12610)](../learnings/1787112652564-approver-confirmed-slang-12610-com-deprecation-wou.md):
  a `[[deprecated]]`-only public-header diff that leaves the vtable slot
  untouched, wraps the single base-typed call, mirrors precedent, and matches the
  stated phase-1 scope is a clean WOULD_APPROVE; zero interval commits confirmed it.
- [`external/slang-rhi` ToT submodule bump — 4-point control (slang#12615)](../learnings/1787136208045-approver-confirmed-safe-slang-rhi-submodule-tot-bu.md):
  production Claude review and CodeRabbit both *structurally skip* a submodule-only
  diff (don't record NO_REVIEW_SIGNAL). The control that carries bits: (1) pin
  dereferences to claimed ToT; (2) forward-only (`ahead`, `behind_by:0`); (3)
  `test-slang-rhi` matrix jobs enumerated directly and green; (4) Devin clean over
  the head. [The merge-join](../learnings/1787150776107-approver-confirmed-safe-slang-rhi-tot-bump-12615-m.md)
  confirmed it merged at the exact decided head with zero interval commits — the
  "clean approval at a later head hides an author-fixed false-safe" mode is
  structurally impossible when merge head == decision head.

## Source learnings (14):

- [A policy abstain resolved by a merge is NOT a disagreement — score by reason family](../learnings/1786999539196-approver-human-disagreement-a-policy-abstain-resol.md) — policy-family (`author_trust`) abstains confirm correct routing on merge; only code-concern abstains score against the falsifiable frame.
- [ABSTAIN:OPEN_GAP on test-infra coverage nits was overruled (slang#12471)](../learnings/1786976249687-approver-human-disagreement-abstain-open-gap-on-te.md) — coverage nits on a maintainer test-infra PR are advisory; distinguish mask-a-wrong-verdict gaps from add-a-test gaps.
- [Over-abstain: diagnostic-label gap + speculative masking window (slang#12573)](../learnings/1786978439947-approver-human-disagreement-over-abstain-a-diagnos.md) — when verdict-correctness holds on every realistic path and only a speculative residual remains, lean WOULD_APPROVE.
- [OVERRULED OPEN_GAP: pre-existing wrong-repo link inert on the only invoked path (slang#12572)](../learnings/1787060182513-approver-human-disagreement-overruled-abstain-open.md) — "documented/supported ≠ exercised"; grep every caller for the flag; bot severity escalation is a labeling artifact.
- [OPEN_GAP on a fatal-but-verified-unreachable assert was overruled (slang#12539)](../learnings/1787149751727-approver-human-disagreement-open-gap-on-a-fatal-bu.md) — internal + verified-unreachable trigger clears as advisory; discriminator vs vindicated BLOCK is reachability + who controls the trigger.
- [Resolve introduced-vs-pre-existing by diffing the BASE (slang#12614)](../learnings/1787156940615-approver-human-disagreement-resolve-introduced-vs-.md) — a pre-existing gap the PR doesn't worsen is advisory; base-diff is decidable, not a reason to abstain.
- [A real-but-pre-existing 🔴 on a strict-improvement fix is CHALLENGER_CONCERN, not BLOCK (slang#12552)](../learnings/1787095789022-approver-challenger-miss-a-real-but-pre-existing-o.md) — check merge-base for pre-existence and what the path did before (crash → strict improvement); BLOCK requires a 🔴 the PR causes.
- [Abstain on a pre-existing 🔴 overruled by merge-as-is (slang#12552 join)](../learnings/1787112757529-approver-human-disagreement-abstain-on-a-pre-exist.md) — abstain was the forced ceiling under the "never upgrade past 🔴" guard; disagreement points at the procedure, not the call.
- [CONFIRMED (no disagreement): whole-repo sanitizer lane is red-on-arrival by nature (slangpy#1112)](../learnings/1787004204123-approver-human-disagreement-confirmed-no-disagreem.md) — author self-closed unmerged; the real question is rollout strategy, whose absence is the OPEN_GAP.
- [Doc-sync PR is a safe WOULD_APPROVE when byte-identical to the fetched-head source (slang#12584)](../learnings/1787061671880-approver-human-agreement-doc-sync-pr-is-a-safe-wou.md) — three probes: byte-diff against source at the head, confirm hand-written not generated, confirm scope vs the issue.
- [A clean, well-tested .github/** workflow-tooling PR merges as-is (slang#12579)](../learnings/1787111103294-approver-human-agreement-confirmed-a-clean-well-te.md) — the live clause script beats a stale protected-path prior; wide policy dropped `.github/**`; probe helper existence + unit test at head.
- [COM-deprecation WOULD_APPROVE matched merge, zero interval commits (slang#12610)](../learnings/1787112652564-approver-confirmed-slang-12610-com-deprecation-wou.md) — the four-point ABI-safe COM-deprecation shape was sufficient for a clean approval.
- [slang-rhi submodule ToT bump — the 4-point control that certifies WOULD_APPROVE (slang#12615)](../learnings/1787136208045-approver-confirmed-safe-slang-rhi-submodule-tot-bu.md) — pin-dereference, forward-only, `test-slang-rhi` green enumerated directly, Devin clean; production review structurally skips submodule diffs.
- [slang-rhi ToT bump merged at decided head, prediction held (slang#12615 join)](../learnings/1787150776107-approver-confirmed-safe-slang-rhi-tot-bump-12615-m.md) — zero interval commits makes the hidden-author-fix failure mode impossible; the 4-point control is empirically sufficient for this shape.
