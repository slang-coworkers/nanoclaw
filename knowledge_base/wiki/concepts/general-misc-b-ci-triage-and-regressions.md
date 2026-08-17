---
title: CI triage — flake vs regression, and the checker whose config has its own history
type: concept
group: general
tags: [ci, flake, regression, merge-queue, github-actions, submodules, deferred-compilation]
source_count: 11
---

## TL;DR

Deciding whether a red CI signal is a real regression or infra noise is a discrimination
problem where the obvious tell often points the wrong way:

- **"Consistent multi-platform failure ⇒ legitimate" is a default, not a law.** Pull a
  *passing* sibling leg on the same sha and grep it for the failing signature — if it's there
  and recovered, the spread is measuring flake *frequency*, not determinism.
- **A signature-based exception rule ("rpc failure ⇒ intermittent") is only sound if the
  signature is ABSENT from healthy runs.** When it co-occurs with success it silently becomes
  "ignore the strongest legitimate tell."
- **Reproduction across hosts and attempts does NOT prove a real regression.** The
  discriminating control is *cross-PR*: does the identical test fail on branches without this
  PR's changes?
- **Check whether the diff can even reach the failure** — a shared-looking file can hold a
  target-scoped change; a CI build-flag change (`-D…=ON`) *does* reach the tests.
- **A wake payload's `evicted` list is not ground truth** — confirm the eviction exists in
  GitHub's ledger (`RemovedFromMergeQueueEvent`, `reason == "failed_checks"`).
- **A repo-wide gate flipping from a long green streak to ~100% failure across unrelated PRs
  suspects a live external lookup**, not a per-PR flake — `git fetch`-reruns can't fix it.
- **A latent defect's visibility toggles independently of the defect** — date the checker's
  config, not just the code; a vacuously-passing check looks like coverage.

## The multi-platform tell and the rpc confound

The babysitter rule "consistent failures across runners ⇒ legitimate, don't rerun" is a good
default, and a case matched it on its face (the same 3 tests failed on both linux-debug-gcc and
windows-release-cl at one sha). What refuted it: the *passing* sibling leg
(`test-linux-release-gcc`, conclusion success) hit the **identical** signature
(`JSON RPC failure: waitForResult()`) and recovered on slang-test's built-in retry. So the mode
was recoverable at that sha — a transport flake whose retry succeeded on one leg and exhausted on
two. Cheap version: for any job matrix, fetch one *successful* sibling and grep it for the
failing signature — absence strengthens "legitimate," presence-plus-recovery refutes it. A survey
restricted to the failing jobs cannot tell you this, and that restriction is invisible in the
result. (Same log: `grep -oE "failed test:"` returned zero while the tally said 3 failures — the
emitted form is uppercase `FAILED`; default to `grep -i` on CI logs.) [A passing sibling job can refute the "consistent multi-platform = legitimate" heuristic](wiki/learnings/1785954484552-a-passing-sibling-job-can-refute-the-consistent-mu.md)

But the rpc-confound rule must not override the multi-platform tell either. Applying it to a PR,
an agent reran a *real regression* because the rpc signatures were present — and the confound
mis-fired because **the rpc signature is not evidence of causation: it appears on legs that
PASS.** The PR had added `-DSLANG_ENABLE_VALIDATION_FOSSIL=ON`, which made a fossil assert
fail-fast in release; the tests spawn a `slangc` child that aborts, killing the channel — so the
rpc-death symptom is the *downstream appearance of the real bug*, which is why it's retry-resistant.
A rule "signature X means intermittent" is only sound if X is absent from healthy runs; when X can
co-occur with success, it silently becomes "ignore the strongest legitimate tell." A failure that
survives your own rerun (4 distinct runners, 2 attempts, byte-identical tallies) has already
falsified the flake hypothesis. And a CI build-flag change *counts as reaching the test* even
when no test-adjacent source file was touched — the "diff can't reach this subsystem" shortcut
fails on build-configuration diffs. [The rpc-confound rule must not override the multi-platform tell — reproduction across hosts/attempts is the discriminator](wiki/learnings/1785961999626-the-rpc-confound-rule-must-not-override-the-multi-.md)

## Reproduction across hosts is not enough — the cross-PR control

The standard discriminator "did it reproduce across hosts and attempts? ⇒ real" pointed the wrong
way and nearly declined a rerun on a genuine known flake. A Falcor job failed twice on two
runners with a byte-identical signature — by host∧attempt that is a regression. It wasn't:
`test_GBufferRTTexGrads_d3d12` (an access violation, `Mogwai.exe … 3221225477`) failed on **6
distinct unrelated branches** in a 25-job sample, with a Falcor job failure rate of ~28% — two
consecutive failures is the *expected* outcome. Host and attempt both vary *within one PR*, so a
flake that hits ~28% of jobs reproduces across hosts trivially. The control that discriminates is
**cross-PR**: does the identical failing test fail on branches without this PR's changes? Order
the evidence: (1) cross-PR control on the failing *test name*, (2) reachability of the diff (a
`slang-emit.cpp` hunk was inside `if (target == HostVM)`, unreachable from Falcor's d3d12 path —
read the enclosing condition, not the filename), (3) only then host/attempt reproduction. Key the
tally on the *signature*, never the host (the same box carried two distinct defects). [Reproduction across hosts does NOT prove a real regression — check the same test on unrelated branches](wiki/learnings/1785975610259-reproduction-across-hosts-does-not-prove-a-real-re.md)

**A repo-wide count from YOUR action log cannot prove "nobody ever did X."** Measuring whether
reruns of a flaky job go green (4 of 5 failed→next-attempt transitions recovered — load-bearing,
because if retries usually fail again then "add retry logic" is theatre), a parent concurrently
concluded the sample "probably didn't exist," from a `rerun-log.jsonl` counting reruns *it
issued* — used to claim *nothing had ever been rerun by anyone*. The recoveries were
`event=pull_request` reruns on PR branches, a population the merge-queue-eviction analysis never
indexed. An agent's own action log is a record of its decisions, never a census of the world;
before declaring a sample nonexistent, make the one call that would find it, especially when
already holding the identifiers. A "probably unmeasurable" verdict aimed at someone mid-measurement
is high-cost — it can retract work that already succeeded. (Also: membership in `needs` proves
ordering, not gating; a run-level "recovered" needs the *signature*, not just
`conclusion=success`.) [A repo-wide count from YOUR action log cannot prove "nobody ever did X"](wiki/learnings/1785980000299-a-repo-wide-count-from-your-action-log-cannot-prov.md)

## Merge-queue payloads and repo-wide external-lookup gates

**A wake payload can mislabel an IN-QUEUE merge-group run as an eviction.** The CI-babysitter
payload's `evicted` list listed a PR with `conclusion: "failure"` — but the GraphQL timeline
showed no `RemovedFromMergeQueueEvent` at all: the PR was *in* the queue
(`mergeQueueEntry = {position:1, state:AWAITING_CHECKS}`, re-enqueued 23 seconds earlier), and
the payload had seen a failed job *inside a still-in-flight* merge-group run. A failing job in a
merge group does not imply eviction (GitHub may retry). Acting on it means requeueing an
already-queued PR — the exact queue-thrashing the requeue cap exists to prevent — so the
idempotency check must run *before* any requeue reasoning. Confirm the eviction in GitHub's ledger:
`RemovedFromMergeQueueEvent` with `reason == "failed_checks"` (`merged` and `checks_timed_out` are
not evictions); a non-null `mergeQueueEntry` ⇒ nothing to requeue. One payload row also produced a
second phantom red (a `workflow_dispatch` failure whose `pull_request` suite on the same sha was
green). [Wake payload can mislabel an IN-QUEUE merge-group run as an eviction](wiki/learnings/1785975600083-wake-payload-can-mislabel-an-in-queue-merge-group-.md)

**`check-submodules` can go red repo-wide when an upstream flips its default branch.** A
submodule-pointer gate went from 96/100 green to 4/4 failing across 3 unrelated PRs in ~3.5 hours
with no `external/` commit landed — because `check-submodule-commits.sh` resolves each submodule's
ref *live* from the upstream remote's current default branch when `.gitmodules` has no `branch =`
override, and `microsoft/mimalloc` flipped `main` → `main3`, from which slang's pin is not
reachable. The pin never moved; the goalpost did. This is the "rerun-CANNOT-succeed" class —
`git fetch`-reruns re-resolve the same live ref. Spot the class by the *cross-PR spread*: 1 PR ⇒
maybe code; 3+ unrelated PRs with no relevant commit ⇒ a shared external input moved. Also: red ≠
blocking (this gate isn't in `check-ci`'s `needs:` — a PR merged past it), and don't attribute an
eviction to a run that *postdates* it (compare the failing job's completion time against the
`RemovedFromMergeQueueEvent` timestamp). [check-submodules can go red repo-wide when an upstream flips its default branch](wiki/learnings/1785983137542-check-submodules-can-go-red-repo-wide-when-an-upst.md)

## Latent defects, deferred compilation, and the checker's own history

**A latent defect's visibility can toggle independently of the defect.** "Is this a regression?"
is usually answered by dating the defective code — which can be right about the code and wrong
about the user's experience, because a defect only manifests through a *checker* whose config has
its own history. A SPIR-V validation defect was "wrong from the day the feature landed" (2025), so
"not a regression, broken in every release" looked obvious — but the observable rejection tracked
the validator's *target environment*, which changed twice: a Universal env permits
`OpCapability Linkage`, a Vulkan env does not, so for 35 releases the check passed *vacuously*.
Date the defect AND the checker; "when did this become visible?" ≠ "when did this become wrong,"
and users only ever report the first. The accurate framing is often compound: a feature-old latent
defect whose user-visible failure was re-exposed by X — publish the phase table, not a binary
yes/no. A vacuously-passing check is worse than a missing one: it looks like coverage. [A latent defect's VISIBILITY can toggle independently of the defect — check the validator/env axis before answering "is it a regression"](wiki/learnings/1785967034838-a-latent-defect-s-visibility-can-toggle-independen.md)

**Deferred compilation makes a codegen crash look like a dispatch crash — and a log line is not a
program counter.** Localizing a SlangPy segfault, "the log reached `Dispatching…`, so the fault is
in dispatch" was wrong: `defer_target_compilation` defaults to `True`, so the debug log prints
`Dispatching…` *before* the deferred compile faults, and the traceback collapses to the bare call
site. Both modes exit rc=139, so the crash gives no hint of mislocalization. Set
`options={"defer_target_compilation": False}` and enable `faulthandler` *before* reading the
traceback — eager mode names the fault site exactly (`create_compute_pipeline` at pipeline
creation, not dispatch). A log line is a *proxy* for control flow, and lazy/deferred/cached work
is exactly where the proxy detaches from the thing. Two adjacent lessons: test the arm you listed
as a caveat (`[CUDAKernel]` → rc=0, `[shader("compute")]` → SIGSEGV — the trigger was
`[shader("compute")]` specifically, changing the scope), and a retraction on one issue does not
reach the siblings carrying the same claim. [Deferred compilation makes a codegen crash look like a dispatch crash — and a debug log line is not a program counter](wiki/learnings/1785962082605-deferred-compilation-makes-a-codegen-crash-look-li.md) [Deferred compilation makes the log lie about the crash phase — force eager before localizing](wiki/learnings/1785967732880-deferred-compilation-makes-the-log-lie-about-the-c.md)

## A silently-ignored argument, and a test that pins nothing

**A silently-ignored argument is worse than a silently-zeroed field — A/B the emitted asm to
catch it.** A CUDA `GetDimensions` mip overload compiled clean and returned mip-0 dimensions —
byte-identical emitted asm across an overload that takes an extra argument proves the argument is
dead (a cross-target control at `-target spirv-asm` proves it's *supposed* to matter). A
wrong-but-plausible value is a worse defect than an obvious sentinel `0` and hides better. The
"is this a feature bug?" discriminator: declare the type and never use it — if it still ICEs, the
*type* fails to lower, not the method. And `slangc … 2>&1 | head -4` reported exit 141 for a
compile that exits 255 (`head` closes the pipe, SIGPIPE) — re-measure without a pipe. [A silently-ignored argument is worse than a silently-zeroed field — A/B the emitted asm to catch it](wiki/learnings/1785958183856-a-silently-ignored-argument-is-worse-than-a-silent.md)

**A test added on the success path pins nothing.** A consumer was changed to print
`<unavailable disassembler>`, "covered" by `CHECK1-NOT` lines in a test that runs with a *real*
disassembler — it only exercises the success path and would stay green through a full revert. Two
ways a green test pins nothing: an assertion too weak to discriminate (`SLANG_FAILED(r)` passes
for both failure codes), and an assertion in a state that never produces the value. The order that
saves wasted work: name the state the changed code needs, ask which harness can construct it,
**verify the symbols link before writing the test body** (`nm -D --defined-only … | grep -c` with
a positive control), and treat "no existing test does X" as evidence X is *impossible*, not that
you're first. When the state is genuinely unreachable, state the gap in the PR — an honest stated
gap beats a green test that misleads the next reader into believing the branch is protected.
Re-verify a copied guard's premise in its new file. [A test added on the success path pins nothing — check state-reachability and symbol linkage BEFORE writing it](wiki/learnings/1785974313644-a-test-added-on-the-success-path-pins-nothing-chec.md)
