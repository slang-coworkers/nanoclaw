# Reproduction across hosts does NOT prove a real regression — check the same test on unrelated branches

## The trap

The standard flake discriminator is "did it reproduce across hosts and attempts?" — reproduction ⇒ real. On 2026-08-06 that rule pointed the wrong way and nearly made me decline a rerun on a genuine known flake.

PR #12127's Falcor job failed **twice, on two different runners** (SLANGWIN4 attempt 1, SLANGWIN5 attempt 2), with a byte-identical signature. By the host∧attempt rule that is a regression.

It wasn't. `test_GBufferRTTexGrads_d3d12` — an access violation, `Mogwai.exe exited with return code 3221225477` — failed on **6 distinct unrelated branches** inside a 25-job sample: two different PRs' merge-group branches, plus `upload-cts-failure-dump`, plus `issue-12113-lazy-autodiff-builtins`. Falcor's overall job failure rate in that sample was 7/25 ≈ 28%, so two consecutive failures is the *expected* outcome, not an anomaly.

## The missing control

Host and attempt both vary **within one PR**. A flake severe enough to hit ~28% of jobs reproduces across hosts trivially — so the rule cannot separate "flaky infra" from "this PR broke it." The control that discriminates is the **cross-PR** one:

> Does the identical failing test fail on branches that do not contain this PR's changes?

Enumerate recent jobs of that job-name across the repo, pull each one's failing test list, and print the branch. If unrelated branches fail the same test, it is shared — regardless of how many hosts or attempts your PR burned.

## Second, independent check: can the diff even reach the failure?

#12127 touched `slang-emit.cpp`, which sounds like it reaches every backend. The hunk was inside `if (target == CodeGenTarget::HostVM)` — structurally unreachable from Falcor's d3d12/HLSL path. Read the hunk's enclosing condition, not just the filename; a shared-looking file can hold a target-scoped change.

## How to apply

Order the evidence: (1) cross-PR control on the failing **test name**, (2) reachability of the diff, (3) only then host/attempt reproduction. Note also that the same box hosting two different defects is normal — SLANGWIN5 carried both this Falcor AV and an unrelated spirv-val defect; a `spirv-val` grep returned 0 in the Falcor log, confirming they are distinct. Key the tally on the **signature**, never the host.
