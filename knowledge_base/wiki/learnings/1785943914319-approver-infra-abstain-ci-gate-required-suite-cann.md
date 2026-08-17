---
title: "[approver/infra-abstain] CI_GATE_REQUIRED_SUITE cannot discriminate on Actions-only repos (all suites share app.slug=github-actions) — and slangpy has no roll-up check-run to name, so REQUIRED_CHECK_RUN needs a new gating job there"
type: learning
topic: slang-compiler
source: learnings/1785943914319-approver-infra-abstain-ci-gate-required-suite-cann.md
---

# [approver/infra-abstain] CI_GATE_REQUIRED_SUITE cannot discriminate on Actions-only repos (all suites share app.slug=github-actions) — and slangpy has no roll-up check-run to name, so REQUIRED_CHECK_RUN needs a new gating job there

# [approver/infra-abstain] Gate precision is bounded by what the repo's CI exposes as a nameable identity

## Symptom

I argued that arming `APPROVER_CI_GATE` **with `CI_GATE_REQUIRED_SUITE`** would have
parked the wake on slangpy#1090, where the build suite is `conclusion: failure`.
Verified the suite table, and the *conclusion* is right — but the **flag I named
cannot do it.** Measured at `bb870c1750cc`, 2026-08-05T15:30:34Z:

```
slug=github-actions | app.name=GitHub Actions | success | wf_runs=1
slug=github-actions | app.name=GitHub Actions | FAILURE | wf_runs=12   ← the build suite
slug=github-actions | app.name=GitHub Actions | success | wf_runs=1
slug=github-actions | app.name=GitHub Actions | skipped | wf_runs=1
… (7 total)
```

The matcher is `!req_ || appSlug === req_ || appName.includes(req_)` — it keys on the
**app**, and **all seven suites are `github-actions`**, `app.name` identical too. So
`CI_GATE_REQUIRED_SUITE=github-actions` matches the three trivial *successes* as
readily as the failing build suite and releases exactly like the unset case. **Suite
identity is not the app on an Actions-only repo**, so the flag has no discriminating
power there at all.

`CI_GATE_REQUIRED_CHECK_RUN` (`owner/repo=check-name`) is the branch that can do it —
but only where a **roll-up** check-run exists:

| repo | roll-up run | gate viable? |
|---|---|---|
| `shader-slang/slang` | `check-ci` (was `failure` on #12359) | ✅ `shader-slang/slang=check-ci` |
| `shader-slang/slangpy` | **none** | ❌ nothing to name |

slangpy's runs at that head: 12 individual `build (os, arch, compiler, config, py)`
legs + `pre-commit`, `bridge`, `board-sync / board-sync`, `Claude Code Assistant`.
**No single name means "the build passed."** Checked the two candidates:
`checks.yml` has only a `pre-commit` job; `pr-checks-complete.yml` is a board-sync
relay (it explains that GitHub deliberately withholds `check_suite`/`check_run`
events for Actions-created suites, hence `workflow_run`), not a gating roll-up.
Pinning one arbitrary leg would gate on a **sample**, not the build.

## Root cause

Gate precision is bounded by the coarsest identity the CI provider exposes. GitHub
gives suites no per-workflow identity in the app fields, so any suite-level gate
degenerates to "some Actions suite went green" on a repo where all CI is Actions —
which is nearly every modern repo. That is the same *just-past-empty* shape again:
the gate is satisfiable while the substance is missing, and the degenerate reading
(`unset`) and the configured reading (`=github-actions`) are **byte-identical in
effect**, so testing the configured case against the unset case shows no difference
and looks like the flag "working."

## How to catch it

Before claiming a gate config would have prevented something, **verify the
discriminator exists in the data**:

```bash
# do suites have distinguishable identity at all?
gh api "repos/$R/commits/$SHA/check-suites?per_page=100" \
  --jq '.check_suites[] | "\(.app.slug) | \(.app.name) | \(.conclusion) | runs=\(.latest_check_runs_count)"'
# is there a roll-up run to name?
gh api "repos/$R/commits/$SHA/check-runs?per_page=100" --jq '.check_runs[].name' | sort -u
```

Falsifiers: (1) all suites share one `app.slug`/`app.name` ⇒ suite-level gating is
inert on this repo; (2) no check-run name denotes the aggregate ⇒ run-level gating
must pin a sample, which is not the build. `latest_check_runs_count` is the useful
tell for *which* suite is the heavyweight one (12 vs 1 here) — but it is not
matchable by the config flag, so it diagnoses rather than fixes.

## Fix

The honest three-way answer for the operator, all measured:

1. **Gate as configured today** (`REQUIRED_SUITE` unset) → would **not** have
   prevented it.
2. **Gate + `REQUIRED_SUITE`** → also would **not**, on slangpy — every suite shares
   one app slug, so the flag cannot discriminate.
3. **Gate + `REQUIRED_CHECK_RUN`** → **would**, on `slang` (`check-ci` red). On
   slangpy, **not until a roll-up job exists** to name.

Actionable consequence: slangpy needs a `needs: [build]` + `if: always()` aggregate
job (the pattern `slang`'s `check-ci` already implements) before the gate can be
precise there. That's an infra gap in the repo, not a config choice — and worth
saying plainly, because "arm both flags" reads as sufficient and isn't.

**Method note, the durable half:** my claim was directionally right and mechanically
wrong — right that the host gate *can* park this, wrong about which flag does it. A
recommendation that names the wrong knob is not a small error: the operator sets it,
observes no change (identical to unset), and concludes the gate doesn't work. **Verify
that a config value has discriminating power on the actual data before recommending
it**, not merely that the code path exists.

Siblings: the over-correction entry (`the gate wouldn't have prevented it` is false
with the *right* flag); "the platform guards empty, the bug lives just past empty";
`ci_green_on_sha`'s `:184` waiver branch.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785943914319-approver-infra-abstain-ci-gate-required-suite-cann.md`_
