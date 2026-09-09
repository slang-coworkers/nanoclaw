---
title: SlangPy PR-approver — calibration from human merge outcomes (false-safe, over-abstain, gap classes)
type: concept
group: slangpy
tags: [slangpy, approver, calibration, human-disagreement, false-safe, abstain, merge-join]
source_count: 12
---

## TL;DR

Every approver decision is joined against the eventual human outcome (merge ⇒
APPROVED-equivalent; closed-unmerged ⇒ REJECTED-equivalent). ABSTAIN rows are
excluded from agreement scoring, so most "human-disagreement" joins on slangpy are
calibration data, not scored errors. The recurring lessons:

- **Abstain on size/scope/protected-path is routing, not concern.** A PR whose only
  abstain reason is `tier_eligible` or `no_protected_paths`, with an otherwise-clean
  signal and a trusted author, reliably merges unchanged. Do NOT let the size cap
  tempt a challenger into manufacturing a code concern, and do NOT upgrade the class
  to WOULD_APPROVE "because it always merges."
- **WOULD_APPROVE means "no correctness defect I could verify," never "a maintainer
  will approve this."** Correctness-only procedures are structurally blind to
  maintainer preference (field ordering, layout, scope). This is a calibration
  ceiling, not a bug to fix.
- **The safe direction of error is ABSTAIN.** Over-abstaining (OPEN_GAP where the
  human approved) is legitimate and not optimized to zero; false-safe (approving a
  real defect) is the worse, different error.
- **Gap classes calibrate differently.** A contract-shaped documented-precondition
  gap that matches the API family's house style, a pure test-coverage gap on a new
  assertion, a missing test on a trivial caller-less utility, and "one more instance
  of an established in-file sibling pattern" all tend to ship as-is. A claim-vs-code
  contradiction (crash/corruption/failing test) is merge-blocking.
- **On `external/**` / dependency bumps the automated reviewers carry ~zero bits; the
  BUILD check-runs carry ~all the bits.** Read CI on every revision; a red head
  abstains regardless of how clean the reviewers look.
- **A slangpy `external/slang-rhi` pin lagging the slang release's own rhi pin is
  frequently a NON-blocker** — the two deps are versioned independently. Surface it,
  but weight it as a question, not evidence of a broken PR.

## Abstain is routing: size, scope, and protected-path classes merge unchanged

The single most reinforced calibration point is that a mechanical-clause abstain is
the gate working correctly, and the human ships the PR unchanged. slangpy#1101 (Logger
deadlock fix) abstained twice solely on `CLAUSE_FAIL:tier_eligible` (403 then 420
lines, a few % over 400) and merged at the exact R2 decision commit — trusted MEMBER
author, same-repo head, clean review signal, only the mechanical size cap failing.
This is the canonical "abstain = routing, not concern" case; do not manufacture a code
concern to justify the size abstain, and report the size reason plainly so the human
isn't misled
[size-cap-only abstain reliably merges](../learnings/1786480897354-approver-human-disagreement-confirmed-size-cap-onl.md).

The `no_protected_paths` class behaves identically. slangpy#1126 ("compile report
cache keys") abstained on `external/slang-rhi` and merged unchanged at the decision
commit — and the CodeRabbit 🟡 test-coverage nit it carried was still present, no
follow-up commit. Two signals: the protected-path abstain on a trusted-MEMBER
routine slang-rhi bump resolves to a clean human merge, and a pure test-coverage 🟡 on
a NEW assertion (not a regression in shipped behavior) clears as advisory
[external/slang-rhi bump merges unchanged, test-nits ride along](../learnings/1787904505718-approver-human-disagreement-slangpy-external-slang.md).
slangpy#1132 (board-sync `GITHUB_TOKEN` write-grant, all 5 files `.github/workflows/*`)
confirms it a second time: abstained on `no_protected_paths`, merged unchanged (the
only interval commit was a routine `Merge branch 'main'` touching unrelated files).
The `.github/**`-only permission abstain is a procedural "a human must look at workflow
YAML" gate, not a signal the content is wrong; the temptation to upgrade these to
WOULD_APPROVE because the automated read is clean is exactly backwards — the policy
deliberately routes workflow-permission YAML to human eyes
[board-sync protected-path abstain merged unchanged](../learnings/1788453054232-approver-confirmed-board-sync-protected-path-absta.md).

## `external/**` / dependency bumps: reviewers carry zero bits, CI carries all the bits

Two joins on the same class point opposite-looking but consistent lessons. When the
build is GREEN, a slang-rhi gitlink bump is safe-to-approve: slangpy#1104
(632b0aee→e11c29cfa, 4 merged rhi commits) had 14/14 green pre-merge check-runs and
was self-merged by the MEMBER author mid-decision — a clean WOULD_APPROVE join. The
key is that the bot/Devin "0 bugs" on a pointer-only diff is a **zero-bit**
observation; the signal that carries real bits is slangpy's OWN CI on the pinned head,
because `ci.yml` runs `tools/ci.py unit-test` on self-hosted real-NVIDIA-GPU runners
(exercises kernel-gen → shader-object-layout → dispatch against the newly-pinned rhi).
Bound the CI claim to the backends slangpy actually tests (D3D12/Vulkan/CUDA; not wgpu)
[gitlink-bump safe when real-GPU CI green](../learnings/1786634647446-approver-human-disagreement-confirmed-slang-rhi-gi.md).

When the build is RED, the same reviewers' cleanliness must be ignored. slangpy#1120
("update vcpkg to 2026.07.29") abstained 3× on `CHALLENGER_CONCERN` and the author
himself closed it UNMERGED — a clean confirmation with no false-safe. All automated
review signal was structurally absent/blind (Claude skipped the shape, CodeRabbit
path-excluded `external/**`, Devin ran clean but diff-only and CI-blind), and the ONLY
signal that ever discriminated safe-from-unsafe was the build check-runs (Windows MSVC
RED on all three revisions while `ci_green_on_sha` read green off CodeRabbit's status).
Each revision was a genuinely different Windows MSVC break, so each needed a fresh
check-run read, never an inference from the prior
[3× ABSTAIN, author closed unmerged](../learnings/1787225489574-approver-calibration-confirmed-safe-3-abstain-on-a.md).
A pin-lag variant: slangpy#1128 ("update Slang to 2026.16.1", 1-line `SGL_SLANG_VERSION`
bump) abstained OPEN_GAP on a maintainer-raised question about whether the
`external/slang-rhi` submodule pin needed to bump to match — then the SAME maintainer
approved "looks fine" 21 min later and it merged unchanged. slangpy's downloaded slang
compiler (`SGL_SLANG_VERSION`) and its bundled slang-rhi submodule are versioned
independently and do NOT move in lockstep for a routine bump; surface the divergence
but weight it as a question that frequently resolves "fine," and watch whether the
resolution required a code change (here it did not)
[slang-rhi pin lag is often a non-blocker](../learnings/1787959291239-approver-human-disagreement-slangpy-slang-rhi-pin-.md).

## The calibration ceiling: correctness-only cannot predict maintainer preference

slangpy#1054 recorded WOULD_APPROVE @ `ebb9f68de8f1` (all 6 clauses pass, Devin clean,
challenger clean) and a human later filed CHANGES_REQUESTED — one objection
(signature-field ordering: "none-variable-length parts... before the variable length
part") hit code that was present, read, and cleared at the decision commit. Filed as
false-safe deliberately (rather than escaping on the 19-commit divergence, which would
flatter the row), with the mitigation stated honestly: no correctness bug was missed,
all four objections are maintainability/scope preferences. The root cause is
structural — the procedure grades correctness (verified bugs, clause conjunction,
adversarial challenger) and has **no lens for "a maintainer will want this structured
differently."** This is a calibration ceiling, not a bug to fix: chasing it manufactures
false abstains. The cheap hedge: on any PR touching a wire/ABI/serialization format,
note that field ordering and layout are maintainer-preference surfaces the procedure
does not grade, and never read a clean correctness pass as "a human will approve this"
[false-safe: correctness-only blind to maintainer preference](../learnings/1786454885063-approver-false-safe-slangpy-1054-would-approve-cle.md).

## Gap classes: which OPEN_GAPs the maintainers let ride

Several joins converge on a taxonomy of when an OPEN_GAP over-abstains. The framework
comes from slangpy#1090 (native-handle import API), which merged over the author's own
squash+rebase with the approver's `OPEN_GAP` (documented-precondition-not-enforced)
unfixed — and adding CUDA import *widened* the gap. It distinguishes two gap classes
for a new low-level interop API: **contract-shaped** (the doc states a caller
precondition the callee doesn't enforce, matching how the API family already behaves)
— report it but expect approval, `OPEN_GAP` reads as a false-positive against the
outcome; versus **claim-vs-code contradiction** (code that crashes/corrupts/contradicts
its own tests) — genuinely merge-blocking (the R2 BLOCK on the aborting Vulkan test was
fixed within hours). The cheap check before abstaining on an unenforced documented
precondition: do **sibling APIs in the same family** enforce theirs? If none do, it is
house style and the gap is advisory
[#1090 merged over CHANGES_REQUESTED; gap classes](../learnings/1786433586210-approver-human-disagreement-slangpy-1090-merged-ov.md).

Three more joins fill in the "ships as-is" side:

- **A trivial, correct-by-inspection, caller-less utility mirroring a tested sibling
  idiom ships without a dedicated test.** slangpy#1129 (a +13-line caller-less
  `sgl::hash_append` header utility) merged test-less at the exact OPEN_GAP decision
  commit, both `pr_review` APPROVED and terminal `pr_merged` agreeing. Sharpened rule:
  treat "no dedicated test" as a nit → lean CLEAR; reserve OPEN_GAP-for-missing-tests
  for code with a reachable trigger, real blast radius, or a behavioral claim the PR
  asserts
  [#1129 merged test-less at OPEN_GAP commit](../learnings/1788444914596-approver-human-disagreement-terminal-confirm-slang.md).

- **One more instance of an established in-file sibling pattern ships as-is.**
  slangpy#1133 (add Window `on_refresh`, mirrors `on_resize`) was self-merged by the
  MEMBER author ~20 min after opening over an OPEN_GAP citing CodeRabbit's 🟠 Major
  exception-safety concern (a raising Python callback unwinding through GLFW C frames).
  When you have CONFIRMED by reading the whole file that the concern is (a) pre-existing
  across every sibling and (b) introduces no new risk class, the "accepted-convention"
  clear is defensible and an OPEN_GAP is likely to over-fire. Probe: is the author a
  maintainer? did they self-merge similar sibling adds before?
  [#1133 self-merged mirror-a-sibling callback](../learnings/1788417974479-approver-human-disagreement-maintainer-self-merged.md).

- **A confined-blast-radius CI-hardening item ships as-is.** slangpy#1119 abstained
  OPEN_GAP on the unverified LLVM-archive download CodeRabbit flagged as merge-gating,
  and the maintainer merged it unchanged at the decision commit. The audited lesson is
  an OVER-abstain that under-weighted blast radius: the download lived in a
  `schedule`+`workflow_dispatch`-only lane (non-required, non-shipped, not the compiler)
  fetched over TLS from the canonical llvm-project release. For a CI/build-infra finding,
  **the decision hinges on blast radius read from the lane's `on:` triggers and whether
  the job is required/shipped — not the bot's severity word.** Confined + trusted host ⇒
  the hardening item is advisory and the gap tends to CLEAR; reachable on PR CI / a
  shipped artifact / the compiler / a required check ⇒ OPEN_GAP stands. (This is the same
  #1119 whose "verify the claim at source" lesson lives in the harness-clauses page; the
  gap-class OPEN_GAP threshold itself was correctly analyzed there — the miss here was
  weighting the blast radius, not the analysis.) Counter-audit: this is a nudge on the
  CI-hardening class only, NOT license to clear a download feeding PR CI or a released
  artifact, and NOT a relaxation of the false-safe bar on 🔴 functional bugs
  [#1119 over-abstain on confined CI-hardening](../learnings/1787230020832-approver-human-disagreement-over-abstain-open-gap-.md).

## The ideal abstain: real gate flagged → human resolves → merge

The healthiest join shape is a real gate firing and a human clearing it quickly.
slang#12595 (test-only, `DIAGNOSTIC_TEST` files, no source change) was WOULD_APPROVE at
R1/R2 under `v0-shadow-wide`, then ABSTAIN_POLICY at R3 under the tightened `v0-shadow`
(fork-head forbidden + a red cross-repo "SlangPy Tests" combined status) — and merged at
the exact R3 commit after MEMBER maintainer `expipiplus1` APPROVED. It calibrates three
things: a red cross-repo (slangpy) CI status on a test-only slang PR is very-likely-infra
(a test-only diff cannot change slangpy runtime), yet the correct move is still ABSTAIN
because `require_ci_green` is not satisfied and the approver must not hand-wave a red
status; `v0-shadow`'s `allow_fork_head:false` is stricter than project practice
(member-authored fork PRs are routine) so it will abstain many mergeable PRs — an
operator-facing signal, not something the approver overrides; and the earlier
WOULD_APPROVE calls on superseded revisions were vindicated because the final diff was a
strict improvement. When the only things between a benign test-only PR and approval are a
fork-head gate and a red cross-repo status that cannot be caused by the diff, expect
APPROVE/merge: abstain (never round up), name both gates precisely, and predict the
likely-unrelated CI cause so the human triages in seconds
[merge-join: test-only PR, red cross-repo + fork-head is the ideal ABSTAIN](../learnings/1788442775037-approver-human-agreement-merge-join-confirms-on-a-.md).

**Source learnings (12):**

- [#1090 merged over CHANGES_REQUESTED with the abstain-gap unfixed — gap classes](../learnings/1786433586210-approver-human-disagreement-slangpy-1090-merged-ov.md) — contract-shaped precondition gap (advisory) vs claim-vs-code contradiction (blocking); check sibling APIs.
- [#1054 WOULD_APPROVE cleared a layout a human later asked to change](../learnings/1786454885063-approver-false-safe-slangpy-1054-would-approve-cle.md) — correctness-only is structurally blind to maintainer preference; a calibration ceiling, not a bug.
- [#1101 size-cap-only abstain on a trusted-author clean-signal PR reliably merges](../learnings/1786480897354-approver-human-disagreement-confirmed-size-cap-onl.md) — abstain = routing, not concern; do not manufacture a code concern to justify it.
- [#1104 slang-rhi gitlink bumps are safe-to-approve when slangpy's real-GPU CI is green on the pinned head](../learnings/1786634647446-approver-human-disagreement-confirmed-slang-rhi-gi.md) — bot "0 bugs" on a pointer diff is zero-bit; CI carries the bits.
- [#1120 3× ABSTAIN on a build-breaking chain → author closed unmerged](../learnings/1787225489574-approver-calibration-confirmed-safe-3-abstain-on-a.md) — on external/** bumps CI carries all the bits; abstain on a red head regardless of clean reviewers.
- [#1119 over-abstain: OPEN_GAP on a confined-blast-radius CI-hardening item the maintainer merged](../learnings/1787230020832-approver-human-disagreement-over-abstain-open-gap-.md) — read blast radius from the lane's on: triggers, not the bot's severity word.
- [#1126 external/slang-rhi bump merges unchanged; 🟡 test-nits ride along](../learnings/1787904505718-approver-human-disagreement-slangpy-external-slang.md) — protected-path abstain is conservative-correct; a new-assertion test-coverage 🟡 clears as advisory.
- [#1128 slang-rhi pin lag on a compiler bump — maintainer-raised, maintainer-resolved "fine"](../learnings/1787959291239-approver-human-disagreement-slangpy-slang-rhi-pin-.md) — the two slang deps are versioned independently; surface the divergence, weight it as a question.
- [#1133 maintainer self-merged a mirror-a-sibling callback add over an OPEN_GAP](../learnings/1788417974479-approver-human-disagreement-maintainer-self-merged.md) — one more instance of an established sibling pattern with no new risk class ships as-is.
- [slang#12595 merge-join — red cross-repo status + fork-head gate is the ideal ABSTAIN class](../learnings/1788442775037-approver-human-agreement-merge-join-confirms-on-a-.md) — real gate flagged, human resolves, merge; never round up but predict the likely-infra cause.
- [#1129 TERMINAL CONFIRM: merged test-less at the OPEN_GAP decision commit](../learnings/1788444914596-approver-human-disagreement-terminal-confirm-slang.md) — trivial correct-by-inspection caller-less utility ships without a dedicated test; treat as a nit.
- [#1132 board-sync protected-path ABSTAIN merged unchanged](../learnings/1788453054232-approver-confirmed-board-sync-protected-path-absta.md) — .github/** permission abstain is procedural; do not upgrade to reduce abstain count.
