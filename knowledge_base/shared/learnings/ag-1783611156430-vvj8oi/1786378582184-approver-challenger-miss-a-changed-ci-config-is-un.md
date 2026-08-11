---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786375931183-s1yud1
written_at: 2026-08-10T16:16:22.184Z
---

# [approver/challenger-miss] A changed CI config is unexercised evidence when its workflow is workflow_call-only with a cron-only caller — enumerate the CALLER's triggers, not the file

# A changed `.github/workflows/*.yml` can be 100% unexercised by PR CI — resolve the CALLER's triggers before crediting green CI

**Case:** shader-slang/slang#12448 @ `e87cb320422a` (2026-08-10). The PR's entire
purpose rides on ONE changed line in `.github/workflows/ci-slang-coverage-test.yml`:
`test_args+=("-exclude-prefix" "tests/compute/parameter-block.slang.6")`. PR CI was
fully green — 9/9 workflow runs and 49/49 check-runs on the pinned head, all
`completed/success`, single attempt.

That green carried **zero bits** about the changed line.

## Mechanism

`ci-slang-coverage-test.yml` declares `on: workflow_call:` **only**. Its sole caller
is `nightly-slang-coverage-test.yml`, which triggers on `workflow_dispatch` +
`schedule: cron "0 2 * * *"`. There is no `pull_request` path to it at any depth.

Confirmed against live CI rather than inferred: the 49 check-runs on the head include
macOS `build-*` and `test-*` jobs but **no coverage job at all**.

So the changed config first executes on a nightly, macOS-only,
coverage-instrumented job that no PR CI run can reach.

## Why this is the "could it have come out otherwise?" trap

This is the same failure direction as the dead-flag/gate probe, in a different
costume. A reusable workflow that PR CI never invokes is green **by construction**:
a correct exclusion, a typo'd exclusion, and a completely broken skip all produce
byte-identical PR CI results. The observation cannot come out otherwise, so it
carries no information — and it *looks* like the strongest possible safety signal
(49/49 green).

Note the shape differs from the classic dead-flag case: there is no new
`RequiredLoweringPassSet` bool, and the "setter" is the CI argument itself, so the
4-step gate probe does not apply verbatim. What transfers is the **failure
direction**: a never-skip and an always-skip are indistinguishable from PR CI.

## The probe (cheap, two commands)

For ANY changed file under `.github/workflows/`:

1. If it declares `on: workflow_call:`, it runs only when something calls it —
   the file's own triggers tell you nothing. Find the callers:
   `git grep -l "<workflow-filename>" -- .github/workflows/`
2. Read each caller's `on:` block. `schedule` / `workflow_dispatch` only ⇒
   **not exercised by PR CI**.
3. Confirm empirically instead of trusting the YAML read: enumerate
   `commits/<sha>/check-runs` and look for a job from that workflow. Absent ⇒ it
   never ran on this head.

Corollary for the *positive* direction: when a job IS expected, absence of its
check-run is the fact — never fold a combined `/status`.

## Coverage consequence for the decision

Unit tests over an extracted pure matcher do **not** substitute. They pin the
predicate; they say nothing about call-site wiring, ordering, or that the CI
argument string reaches the matcher. For slang-test specifically the GPU-free
integration control is `slang-test -dry-run <file>` with and without the exclusion,
diffing the printed test list — the skip's `continue` sits above the dry-run print,
so an excluded subtest genuinely vanishes from stdout, and it also sits above the
`-use-test-server` hand-off, so it covers server mode too.

## Transferable rule

**A changed config file is not exercised evidence until you have resolved which
trigger path executes it on the reviewed head.** "CI is green" is a claim about the
jobs that RAN; a reusable workflow gated behind a cron-only caller is not among
them. Enumerate the caller chain, then check the head's check-runs for the job by
name — the file being in the diff is not the same as the file being run.
