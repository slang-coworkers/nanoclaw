---
title: Green CI carries zero bits — positive controls, check-runs vs status, coverage PRs
type: concept
group: ci-tooling
tags: [approver, ci-green, positive-control, check-runs, ci_green_on_sha, coverage, could-it-come-out-otherwise]
source_count: 19
---

## TL;DR

The governing question for every "CI is green" claim is: **could this observation have come
out otherwise?** If a never-skip, an always-skip, and a correct change all produce
byte-identical green CI, that green carries **zero bits** — it is not weak evidence, it is
no evidence. This bites approvers constantly, in several concrete shapes:

- **A green check-run conclusion aggregates a whole job.** `success` means nothing failed,
  not that any particular test *ran*. A silently-skipped test (no GPU, unmet marker, wrong
  runtime) leaves CI green while asserting nothing — grep the job log for the test's own
  `PASSED` line to get a real positive control.
- **A changed file is not exercised evidence until you resolve which trigger runs it.** A
  `workflow_call`-only workflow behind a cron caller, a `workflow_dispatch`-only job, or a
  force-flag the runner never reads are green by construction and unexercised by PR CI.
- **`ci_green_on_sha` is systematically broken two ways.** It reads only the legacy
  combined-status endpoint (blind to GitHub Actions check-runs = the real build matrix), and
  under `require_ci_green:false` it passes VACUOUSLY with evidence string "policy does not
  require CI green." Read the evidence string; a vacuous pass carries zero bits.
- **check-runs and commit statuses are two disjoint surfaces.** Combined `/status` over-scopes
  down (CLA+bot statuses only) AND you can miss cross-repo integration statuses (`SlangPy
  Tests`) if you read only check-runs. Read BOTH; use `gh pr checks` (de-duped current rollup)
  for the ledger, not raw superseded check-runs.
- **For a "add CI coverage for X" PR, the decision = are the NEW jobs green** — enumerate the
  jobs the PR ADDS by name; a dedicated build+run lane that goes green is a discriminating
  control (the harness exits nonzero on testCount==0).
- **A guard/instrumentation PR needs the failing direction demonstrated** — run the grep-guard
  against a violating tree; arm a deliberate fault to exercise a capture path. "Can't reproduce
  the flake" ≠ "can't test the change."

Positive control = an observation that would have differed had the guarded work not happened.
Cite the log line, not the badge.

## Green aggregates a job; it does not prove a path ran

The foundational atom:
[green CI does not prove a new conditional path ran — grep the job log for the test NAME](../learnings/1786381632620-approver-challenger-green-ci-does-not-prove-a-new-.md).
On slangpy#1097 (opt-in parallel-compilation flag + a test), 12 green `build` check-runs
tempted "green, and there's a test, so it's covered" — but a check-run `success` aggregates
the whole job and says nothing about any single test running. GPU-dependent tests are the
common case: the same file yields real coverage on device-having runners and a skip
elsewhere, all `success`. The fix: find the job that runs the step and grep its log for the
test's own name (`[gw0] PASSED ...test_parallel...[DeviceType.vulkan]`) — that upgrades green
from zero bits to a positive control, and read the trailing `N passed, M skipped` to confirm
the new test isn't among the skips. This is the "dead-flag" failure mode transposed: a dead
flag has no setter, a dead test has no execution, and neither is visible from the conclusion.

The same shape recurs where a PR's whole purpose rides on an unexercised path.
[A changed .github/workflows/*.yml can be 100% unexercised by PR CI](../learnings/1786378582184-approver-challenger-miss-a-changed-ci-config-is-un.md):
the changed line lived in a `workflow_call`-only workflow whose sole caller is cron-only, so
9/9 workflow runs and 49/49 check-runs were green over a config line PR CI never reached —
enumerate the CALLER's triggers, then confirm the head's check-runs contain the job by name.
[CI force-flag PRs: green carries zero bits](../learnings/1786387985233-ci-force-flag-prs-green-carries-zero-bits-get-the-.md)
adds the runner-provenance corollary: an env var at a scope the runner never reads is a silent
no-op that leaves CI green identically, and `runs-on:` is a *request* — what actually ran is
only in `actions/jobs/<id>` (`labels`/`runner_name`). Demand a positive token from the runner
(the "forced to run on Node.js 24" annotation), bound to the pool that will execute the change,
because "same construct elsewhere" is evidence only if "elsewhere" shares the execution substrate.

## `ci_green_on_sha` is doubly broken: wrong endpoint + vacuous pass

Four atoms document the same clause failing across slang, slangpy, and nanoclaw. The clause
reads `commits/{sha}/status` — the legacy combined-status endpoint — which aggregates only
old-style commit *statuses* (`CodeRabbit`, `license/cla`, `SlangPy Tests`), never GitHub
Actions **check-runs**, which are where every compiled build lives
([ci_green_on_sha folds commits/SHA/status — green over the wrong object set](../learnings/1786437258677-approver-clause-gap-ci-green-on-sha-folds-commits-.md),
[reads combined-status, misses check-runs-only repos](../learnings/1786970473949-approver-clause-gap-ci-green-on-sha-reads-combined.md),
[combined-status blind to the real build matrix](../learnings/1787045208678-approver-clause-gap-ci-green-on-sha-reads-combined.md),
[combined status blind to build check-runs](../learnings/1787214497184-approver-clause-gap-ci-green-on-sha-reads-combined.md)).
So the clause reports GREEN over a head with a red Windows build, or UNEVALUABLE
("combined status=pending") on check-runs-only repos where CI is actually green, or PASS while
14 build jobs are still QUEUED. The second defect compounds it:
[ci_green_on_sha passes vacuously — a Devin-only approve can ship over 4 RED test-slang jobs](../learnings/1786607817941-approver-clause-gap-ci-green-on-sha-passes-vacuous.md)
shows the clause "passing" with evidence string `"policy does not require CI green"` under
`require_ci_green:false` — a pass that carries ZERO bits about CI, most dangerous on the
Devin-only tier where nothing else runs the suite. Read the per-clause EVIDENCE STRING, not
the pass/fail. On a `WOULD_APPROVE` path a false green is a false-safe with no absorber (unlike
an ABSTAIN, which routes to a human anyway), so this must be fixed before enforcement.

The inverse mistake is real too:
[CI rollup: check-runs != commit statuses — read BOTH](../learnings/1787875959183-approver-clause-gap-ci-rollup-check-runs-commit-st.md)
records writing "CI fully green" off 57 green check-runs while the combined `/status` was
`failure` because `SlangPy Tests` (a status POSTED by the slangpy repo) was red — a cross-repo
integration status never appears in the origin repo's check-runs. Over-trusting a folded
`/status` and never reading statuses at all are opposite errors with the same fix: read both
surfaces and report the union. For the ledger specifically,
[report CI via gh pr checks (current rollup), NOT raw check-runs](../learnings/1786993469118-approver-infra-abstain-report-ci-to-the-ledger-via.md):
raw REST lists SUPERSEDED historical runs, so de-dup by name (keep latest per check) or use the
de-duped `gh pr checks` rollup, and time-pin the claim. That atom also carries the reassuring
insight that a red `review` check = the production "Claude PR Review" automation erroring out,
which is exactly the expected Devin-only fallback trigger (`collect-reviews.sh` exit 20), not a
PR defect.

## Pagination silently truncates the CI claim

Even reading the right endpoint, a single page hides failures.
[CI check-runs paginate — a single page (30 of 141) hid 2 failure rows](../learnings/1786482528127-approver-clause-gap-ci-check-runs-paginate-a-singl.md)
and
[CI check-run count: single-page jq undercounts skips](../learnings/1786707862561-approver-infra-abstain-ci-check-run-count-single-p.md)
both record "all green" / "50/50" claims that were false because `total_count` (141, 50) sat in
the same response unread. Always `--paginate` (or hand-page `?per_page=100&page=N` — bare
`--paginate` on the proxy 401s by rewriting to the `repositories/<id>` prefix), cross-check
`total_count == processed`, and NAME every non-success (skipped/failed/cancelled) rather than
folding to "N green" — "N success" is not "N/N green." Same-named checks with mixed conclusions
across attempts also require resolving each run's attempt before attributing color.

## "Add coverage for X" and guard/instrumentation PRs: the decision is the failing direction

For a PR whose stated purpose is *add CI coverage*, the decision-relevant question is not "did
the diff compile" but "is the coverage it introduces actually green?"
[CI-coverage PRs: check the NEW jobs via check-runs, not folded /status](../learnings/1786478437471-approver-challenger-miss-ci-coverage-prs-check-the.md)
caught 2 of 4 newly-added lavapipe jobs RED (visible only in check-runs), and
[CI-coverage PR converges to WOULD_APPROVE only when ALL its own new jobs go green](../learnings/1786484769779-approver-challenger-confirmed-ci-coverage-pr-conve.md)
tracks the same PR across a 4-revision chain — green-on-one-config is never green, the failure
set shifts between revisions, and WOULD_APPROVE needs the full arch×OS matrix green plus a
principled diff. When the new coverage IS the control,
[a test-infra PR with a dedicated CI lane that builds+runs the new target is a discriminating control](../learnings/1786711832544-approver-test-infra-pr-with-a-dedicated-ci-lane-th.md):
a green lane that statically links + builds + runs the new executable answers "does it link/run"
by construction (the harness exits 1 on testCount==0), so no local build is needed — but that
atom also warns the gate/flag probe is for compiler-pass flags, NOT CMake build guards, and to
run eval-clauses and read the emitted `policy_version` rather than hand-judging protected paths.

Two atoms extend the positive-control demand to guards and instrumentation.
[CI grep-guard PRs need a positive control run against a violating tree](../learnings/1787912033500-approver-challenger-calibration-ci-grep-guard-prs-.md):
a new `git grep` guard runs green on the clean head, but green carries zero bits about whether it
CATCHES a reintroduction — run the exact script against a pre-migration tree with real violations
and confirm it exits 1. (Calibration: a shell guard's live-vs-dead is trivially observable, so a
missing bundled self-test is a NIT, not OPEN_GAP — the OPEN_GAP escalation is reserved for
structurally-unobservable cases like compiler-pass gating.)
[Instrumentation PRs: "can't reproduce the flake" ≠ "can't test the change"](../learnings/1787158647458-approver-critique-mustfix-instrumentation-prs-can-.md):
reproducing a rare non-deterministic fault is impossible, but proving the capture+upload
machinery works is constructible with a deliberate-fault subprocess — the missing control is
OPEN_GAP, not advisory, and green CI on `pull_request` doesn't count when the modified upload path
is invoked only by a workflow that never ran on the head.

Finally, "green" is a positive control only for the paths the ENABLED tests hit.
[submodule/dep bump: green CI is a positive control only for the behavior the enabled tests exercise](../learnings/1787049650737-approver-challenger-submodule-dep-bump-green-ci-is.md)
names both over- and under-abstain: for a behavioral dep bump, line up what the bump changes
(read upstream commit titles) against whether any enabled test triggers that specific behavior —
the consumer usually does NOT build the dependency's own regression test, so the trigger-present
control for the changed behavior can be absent even when basic integration is green.

**Source learnings (19):**

- [A changed .github/workflows/*.yml can be 100% unexercised by PR CI](../learnings/1786378582184-approver-challenger-miss-a-changed-ci-config-is-un.md) — a workflow_call-only workflow behind a cron caller is green by construction; enumerate the caller's triggers and check the head's check-runs by name.
- [Green CI does not prove a new conditional path ran — grep the job log for the test NAME](../learnings/1786381632620-approver-challenger-green-ci-does-not-prove-a-new-.md) — a check-run success aggregates a job; a silently-skipped test leaves it green; cite the PASSED log line as the positive control.
- [CI force-flag PRs: green carries zero bits — get the runner-log token on the same pool](../learnings/1786387985233-ci-force-flag-prs-green-carries-zero-bits-get-the-.md) — a flag the runner ignores is a green no-op; runs-on is a request, actions/jobs/<id> is what ran; bind evidence to the executing pool.
- [ci_green_on_sha folds commits/SHA/status — green over the wrong object set](../learnings/1786437258677-approver-clause-gap-ci-green-on-sha-folds-commits-.md) — combined /status can't see compiled builds; a pass whose evidence is "policy does not require X" carries zero bits; read which branch produced the pass.
- [CI-coverage PRs: check the NEW jobs are green via check-runs, not folded /status](../learnings/1786478437471-approver-challenger-miss-ci-coverage-prs-check-the.md) — 2/4 new lavapipe jobs red, invisible in the CLA+bot /status; failures the new coverage exposes are OPEN_GAP not BLOCK.
- [CI check-runs paginate — a single page (30 of 141) hid 2 failure rows](../learnings/1786482528127-approver-clause-gap-ci-check-runs-paginate-a-singl.md) — "all green" false off page 1; hand-page ?per_page=100&page=N; resolve mixed conclusions per attempt.
- [CI-coverage PR converges to WOULD_APPROVE only when ALL its own new jobs go green](../learnings/1786484769779-approver-challenger-confirmed-ci-coverage-pr-conve.md) — track per revision via check-runs + total_count==fetched + run_attempt; green-on-one-config is never green; the failure set shifts.
- [ci_green_on_sha passes vacuously — a Devin-only approve can ship over 4 RED test-slang jobs](../learnings/1786607817941-approver-clause-gap-ci-green-on-sha-passes-vacuous.md) — under require_ci_green:false the clause passes carrying zero bits; enumerate head check-runs every decision; a red head is at minimum an ABSTAIN.
- [CI check-run count: single-page jq undercounts skips; use --paginate + name every non-success](../learnings/1786707862561-approver-infra-abstain-ci-check-run-count-single-p.md) — "48 success + 1 skipped" was really 48+2; name skipped/failed/cancelled explicitly; a targeted status beats a raw green count for over-reach.
- [test-infra PR with a dedicated CI lane that builds+runs the new target = discriminating control](../learnings/1786711832544-approver-test-infra-pr-with-a-dedicated-ci-lane-th.md) — a green build+run lane answers link/run by construction (harness exits nonzero on testCount==0); gate/flag probe is for compiler flags not CMake guards; read the emitted policy_version.
- [ci_green_on_sha reads combined-status, misses check-runs-only repos](../learnings/1786970473949-approver-clause-gap-ci-green-on-sha-reads-combined.md) — UNEVALUABLE "combined status=pending" on Actions-only repos (nanoclaw) is an instrument artifact; cross-check statusCheckRollup before treating CI as unknown.
- [CI-green + all-bots-stale-on-head hides an untested new branch](../learnings/1786991039156-approver-challenger-miss-ci-green-all-bots-stale-o.md) — a failed production review + stale/paused CodeRabbit leave the head unreviewed while looking reviewed; grep the suite for a test that reaches the branch's trigger.
- [Report CI to the ledger via gh pr checks (current rollup), NOT raw check-runs](../learnings/1786993469118-approver-infra-abstain-report-ci-to-the-ledger-via.md) — raw REST lists superseded runs; de-dup by name or use gh pr checks; a red production `review` check is the expected Devin-only fallback trigger, not a PR defect.
- [ci_green_on_sha reads combined-status only — blind to GitHub Actions check-runs](../learnings/1787045208678-approver-clause-gap-ci-green-on-sha-reads-combined.md) — on slangpy the clause passes while the entire C++ build matrix is queued; require every non-skipped check-run SUCCESS then fold in combined status.
- [submodule/dep bump: green CI is a positive control only for the behavior the enabled tests exercise](../learnings/1787049650737-approver-challenger-submodule-dep-bump-green-ci-is.md) — name what the bump changes vs which enabled test triggers it; the consumer usually doesn't build the dep's own regression test; say "the subset called is signature-stable," not "no API changes."
- [Instrumentation PRs: "can't reproduce the flake" ≠ "can't test the change"](../learnings/1787158647458-approver-critique-mustfix-instrumentation-prs-can-.md) — a deliberate-fault subprocess can exercise a capture path; green CI on pull_request doesn't count when the modified upload path never ran on the head; missing control = OPEN_GAP.
- [ci_green_on_sha reads combined status, blind to build check-runs](../learnings/1787214497184-approver-clause-gap-ci-green-on-sha-reads-combined.md) — on a vcpkg bump the clause passed while both Windows MSVC builds failed; the build check-runs ARE the blast radius; attribute via base-branch same-name check-runs.
- [CI rollup: check-runs != commit statuses — read BOTH before any green-CI claim](../learnings/1787875959183-approver-clause-gap-ci-rollup-check-runs-commit-st.md) — a cross-repo SlangPy Tests status was red and invisible to check-runs; over-trusting /status and never reading it are opposite errors; report the union.
- [CI grep-guard PRs need a positive control run against a violating tree](../learnings/1787912033500-approver-challenger-calibration-ci-grep-guard-prs-.md) — green on a clean tree proves nothing; run the guard against a violating checkout; a shell guard's dead-vs-live is observable, so a missing self-test is a NIT not OPEN_GAP.
