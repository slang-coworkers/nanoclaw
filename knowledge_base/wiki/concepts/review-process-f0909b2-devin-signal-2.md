---
title: Devin false positives and low-information verdicts
type: concept
group: review-process
tags: [approver, challenger, devin, false-positive, positive-control, reachability, fallback-tier, coverage]
source_count: 11
---

## TL;DR

Devin's output on the fallback tier is a **prior, not a verdict**. It summarizes and
tends to *agree with* the PR body rather than independently falsify it, and it flags
*behavior* it cannot build or run. Two failure directions matter:

- **Low-information APPROVE / clean.** When a PR's correctness rests on an *empirical*
  claim (a global/pool/handler is live on path X; a test still covers regression Y), a
  clean Devin verdict — or "N reviews, 0 bugs" — carries near-zero discriminating bits:
  it is byte-identical to the genuinely-safe case. Only a runtime reachability check
  (breakpoint hit, or a test that fails without the change on the real repro) tests it.
  If the author themselves hedges the causal claim ("not directly proven locally"), that
  is a first-class ABSTAIN(OPEN_GAP) trigger, and Devin echoing that hedge is not
  corroboration. A coverage-*reducing* test change with a clean Devin verdict is a
  vacuous-test smell — apply the positive-control / revert drill.
- **False-positive 🔴.** Devin invents "Repo rule" process violations, flags concerns
  that live in *untouched pre-existing* code the new path merely reaches, and reports
  device/extension edges that are documented design intent or self-retract across
  revisions. Before charging a Devin 🔴: verify the rule actually exists in-repo (and
  that sibling merged PRs obeyed it), diff the flagged construct against base to classify
  regression-vs-pre-existing, and confirm coop-matrix / capability facts from source
  (Vulkan headers, capdef, emit), never from DeepWiki/LLM.

Decision consequence: a fallback-tier 🔴 can NEVER be rounded up to WOULD_APPROVE
(uncertainty ⇒ ABSTAIN), but neither does an *unverified* 🔴 justify BLOCK — BLOCK
requires a VERIFIED PR-introduced bug. A pre-existing or documented-intent concern goes
to the human as advisory. A standing human CHANGES_REQUESTED always outranks a clean
Devin. And never launder an AI reviewer's "Testing" prose into an executed positive
control — the only build control that counts is CI's own job conclusion or a build you
can point at.

## Devin echoes the author: clean verdicts carry low bits

The recurring near-miss is a Devin-only APPROVE that merely restates the PR's own
premise. On slang#12710 (join slang-rhi's global task pool at teardown), Devin reproduced
the PR description almost verbatim ("worker pool unjoined → survives dlclose → heap
corruption") and even flagged its own key premise as "not directly proven locally," while
a human MEMBER set an LLDB breakpoint on `rhi::globalTaskPool()` that was **never hit** on
the single-entry-point repro — the pool the PR claims to fix is not even instantiated
[Devin-only APPROVE can merely echo the PR author's premise](../learnings/1788200263542-approver-challenger-miss-devin-only-approve-can-me.md).
The calibration join confirmed it: the PR closed unmerged at that exact commit, the author
conceding "this does not fix #12706." The transferable rule is that review COUNT and
"0 bugs" are ~0 bits against an empirical reachability claim, and the author's own hedge
is the strongest admission the load-bearing premise is untested
[Clean-review COUNT is ~0 bits against an unproven causal premise](../learnings/1788206068014-approver-challenger-miss-clean-review-count-is-0-b.md).
The same echo dynamic makes Devin dangerous on **coverage-reducing** test PRs: on
slang#12800 the fix dropped `texture.Sample` / `p1.t.Load` so two descriptor-handle tests
collapse to a plain buffer copy, and Devin echoed the author's "incidental scaffolding"
rationale as "no bugs, valid fix" while a MEMBER argued the change removes the live
bindless-heap regression coverage for #9870. A clean Devin verdict on a test that *deletes*
a dereference/Sample/Load/assertion is byte-identical to a safe one — apply the revert
drill: would the test still FAIL on the pre-fix state?
[Devin rubber-stamps coverage-reducing bot test PRs](../learnings/1788207835532-approver-challenger-miss-devin-rubber-stamps-cover.md).

## Devin false-positive 🔴s: rules, pre-existing code, and capability facts

Devin invents process rules. On slang#12514 its only 🔴 was "new compiler error introduced
without required documentation update — Repo rule," but no such rule exists: diagnostics
are generated from `slang-diagnostics.lua`, and sibling codes 55101/55102 appear in no doc.
A "rule" recent merged PRs of the same shape ignored is not a rule — verify it in-repo
before treating a process 🔴 as blocking
[Devin's 'new diagnostic requires doc update (Repo rule)' is a false positive](../learnings/1788247100911-approver-devin-signal-devin-s-new-diagnostic-requi.md).
The same "rule paraphrase" misfire hit slang#12881, where Devin 🔴'd "broken tests bypass
nightly failures" on *additive* `expected-failures.txt` keys — the documented, intended
mechanism (slang-test still runs each listed test); the same net diff a week earlier drew
no flag at all, exposing Devin's per-run non-determinism. Direction matters: ADDING a key
is safe, DELETING a suppression is the direction to scrutinize
[Devin false-positive 'broken tests bypass nightly failures' on expected-failures.txt](../learnings/1788872770328-approver-challenger-calibration-devin-false-positi.md).

A flag pinned to a *new* line does not make the concern PR-introduced. On slang#12853 Devin
🔴'd "virtual file aliases create duplicate modules" at the opening brace of a new block,
but the module-dedup behavior it described was in entirely untouched code the new path
merely *reaches* — pre-existing and orthogonal, so no BLOCK (blocking would demand the PR
fix out-of-scope code), forward to a human
[Reviewer flag pinned at a new-code line whose concern is pre-existing](../learnings/1788255393191-approver-challenger-reviewer-flag-pinned-at-a-new-.md).
The general method is the regression-vs-pre-existing diff: on slang#12601 Devin 🔴'd a
macOS `brew install` line the PR was rewriting, but the ORIGINAL master block also omitted
grep/findutils/diffutils — a pre-existing gap doesn't become the PR's bug just because the
PR edits nearby lines (this atom also documents the concrete `extras/formatting.sh` macOS
GNU-tools requirement worth checking on any macOS formatter-doc PR)
[A reviewer 🔴 on a block the PR rewrites: classify regression vs pre-existing](../learnings/1788244718967-approver-challenger-a-reviewer-on-a-block-the-pr-r.md).

For capability/extension flags, refute from authoritative source. Devin 🔴'd slang-rhi#851
"tensor-addressing shaders miss required extension," but there is no `VK_NV_tensor_addressing`
device extension — `SPV_NV_tensor_addressing` is a **SPIR-V** module extension provided by
the umbrella `VK_NV_cooperative_matrix2` the PR already enables; distinguish `SPV_*` (emitted
via `OpExtension`) from `VK_*` (enabled at `vkCreateDevice`) and grep the vendored
`vulkan_core.h`
[Devin false-positive: coopmat2 tensor-addressing needs no separate VK extension](../learnings/1788385041370-approver-challenger-miss-devin-false-positive-coop.md).
A companion calibration tempers an earlier device-creation prior on the sibling slang-rhi#852:
the human maintainer never raised the device-creation concern (their only note was
organizational), and Devin self-retracted its `vk-device.cpp:1140` 🔴 across revisions —
so a lone unverified Devin device-creation 🔴 must not be auto-escalated to a durable
"probe this class" learning
[Calibration: Devin 'device-creation breaks' on coop-mat2 #852 was likely FP](../learnings/1788465294331-approver-challenger-miss-calibration-devin-device-.md).

## Positive controls, no-op arms, and laundered "Testing" blocks

Two cross-cutting disciplines close the loop. First, a critique flag on a **no-op /
early-return / "no action needed" arm** is a latent "is this really a no-op?" question, not
a prose nit — on slang-rhi#843 codex held a must-fix on the author's "no action needed for
sub-objects bound though a push constant" comment, and the join proved the no-op silently
drops push-constant data. A gate finding you route to "advisory" still owes an answer to
the correctness question underneath it: enumerate every form that reaches the arm and name
where each form's data is handled
[A comment-hygiene flag on a no-op arm is a latent 'is this a no-op?' question](../learnings/1787920448553-approver-challenger-miss-a-critique-comment-hygien.md).
Second, never invent a positive control. On slangpy#1127 the challenger claimed "Devin
built SlangPy and ran pytest — an executed positive control," but Devin's "Testing" section
was *verbatim identical* to the PR description's — an echo of author-reported steps, with
commit-status `"unknown"` and a `3/16` Checks pane confirming Devin never built anything.
Real execution leaves logs/durations/exit codes; the only build control that counts is CI's
own conclusion or a binary you can point at
[Don't launder an AI-review 'Testing' block into an executed positive control](../learnings/1787953818152-approver-critique-mustfix-don-t-launder-an-ai-revi.md).

**Source learnings (11):**
- [A comment-hygiene flag on a no-op arm is a latent 'is this a no-op?' question](../learnings/1787920448553-approver-challenger-miss-a-critique-comment-hygien.md) — re-derive the safety of a no-op/early-return arm rather than arguing the pointer out of scope; slang-rhi#843 push-constant drop.
- [Devin-only APPROVE can merely echo the PR author's premise](../learnings/1788200263542-approver-challenger-miss-devin-only-approve-can-me.md) — slang#12710 Devin restated PR reasoning; human LLDB breakpoint never hit; empirical reachability must be probed independently.
- [Clean-review COUNT is ~0 bits against an unproven causal premise](../learnings/1788206068014-approver-challenger-miss-clean-review-count-is-0-b.md) — #12710 closed unmerged; author's own "unproven" hedge is a first-class ABSTAIN(OPEN_GAP) trigger.
- [Devin rubber-stamps coverage-reducing bot test PRs](../learnings/1788207835532-approver-challenger-miss-devin-rubber-stamps-cover.md) — clean Devin on a test that deletes a deref/Sample/Load is low-info; apply the revert/positive-control drill.
- [Devin's 'new diagnostic requires doc update (Repo rule)' is a false positive](../learnings/1788247100911-approver-devin-signal-devin-s-new-diagnostic-requi.md) — no such slang rule; diagnostics generated from .lua; verify a "Repo rule" against sibling merged PRs.
- [Reviewer flag pinned at a new-code line whose concern is pre-existing](../learnings/1788255393191-approver-challenger-reviewer-flag-pinned-at-a-new-.md) — slang#12853 dedup behavior was in untouched code; forward to human, don't BLOCK; bot-authored ⇒ author_trust FAIL anyway.
- [A reviewer 🔴 on a block the PR rewrites: classify regression vs pre-existing](../learnings/1788244718967-approver-challenger-a-reviewer-on-a-block-the-pr-r.md) — diff flagged construct against base; slang#12601 macOS brew gap was pre-existing; formatting.sh GNU-tools requirement.
- [Devin false-positive: coopmat2 tensor-addressing needs no separate VK extension](../learnings/1788385041370-approver-challenger-miss-devin-false-positive-coop.md) — distinguish SPV_* module extensions from VK_* device extensions; refute from vulkan_core.h / capdef / emit, not LLM.
- [Calibration: Devin 'device-creation breaks' on coop-mat2 #852 was likely FP](../learnings/1788465294331-approver-challenger-miss-calibration-devin-device-.md) — human silent on it + Devin self-resolved; don't anchor a durable prior on one unverified Devin 🔴.
- [Devin false-positive 'broken tests bypass nightly failures' on expected-failures.txt](../learnings/1788872770328-approver-challenger-calibration-devin-false-positi.md) — adding keys is the safe direction; per-run non-determinism; BLOCK needs a deleted test / removed CHECK.
- [Don't launder an AI-review 'Testing' block into an executed positive control](../learnings/1787953818152-approver-critique-mustfix-don-t-launder-an-ai-revi.md) — Devin "Testing" section echoed the PR body; only CI's conclusion or a real build counts as a control.
