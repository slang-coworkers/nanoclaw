---
title: "CI Flake Triage & Runner Attribution"
type: concept
group: ci
tags: [ci, flake, self-hosted-runner, runner-pool, attribution, triage, infra-vs-code]
source_count: 8
---

## TL;DR

- **Universality is the tell for a broken tool, not a code bug.** A job that reports `PASSING [866/866]` for compile but `spirv-val [0/866]` is a missing/broken *validator*, not a mass regression — a code change fails a *subset*. Any "suspiciously total wipeout" (0/N, 100% fail) next to healthy signals from the same run points at the measuring instrument first.
- **`runs-on: <label>` is a pool, not a machine.** A rerun cannot target a runner. A pass after a rerun is evidence about *the box it landed on*, never about the defect. Testing a repair requires drawing the suspect box; a green on a different member settles nothing.
- **Attribute a runner-scoped defect with a host × job × conclusion cross-tab, never a list of reds.** The defect is the single all-fail cell. One table simultaneously rules out code regression (other hosts green on the same job) and dead host (this host green on other jobs).
- **A failure filter on `event`+`branch` is runner-blind.** A broken self-hosted node produces `schedule`-on-`master` failures that pass every noise filter and look maximally real. Fetch `runner_name` before escalating; treat a surviving failure as *unclassified*, not *real*.
- **The tree-identical control settles it:** merge queues re-run identical `.commit.tree.sha` under different shas/hosts — same code, different box, opposite results ⇒ infra.
- **Key a flake cost tally on the SIGNATURE, never the HOST** — two independent defects can share a box, and a grep over your own free-text `reason` fields conflates "ran on X" with "X broke it". Re-open each run's job list.
- **A 0-success box is negative capacity, not 1/N** — it consumes a full ~10 min slot per draw plus the induced rerun, and occupies the pool during the contention it's blamed for.
- **Record `runner_name` on the FAILING attempt too**, captured at run time — it's only readable while the log lives (HTTP 410 after ~7 days).

## Universality is the signature of a broken tool

When a CI job shows *all* of one check passing and *all* of a second check failing — `PASSING [866/866]` compile plus `PASSING spirv-val [0/866]` — that is a missing or broken tool, not a code regression. A compiler change breaks a *subset*; universal failure is the tell. The underlying in-tree defect is often that a function collapses "couldn't measure" and "measured a failure" into one return value: `GlslangDownstreamCompiler::validate` returns a bare `SLANG_FAIL` for both "validator unavailable" and "shader genuinely invalid," making the two indistinguishable by construction. **Any API that collapses "couldn't measure" into "measured a failure" will eventually cost someone a P0-shaped triage.**

A subtle corollary: the discriminator between "validator broke" and "shader genuinely invalid" is **"is a validator error body present?"**, *not* "are there zero diagnostics." The per-shader `SpirvValidationFailed` diagnostic is emitted in both cases; what's missing when the symbol is absent is the validator's own `error: line …` output. The plausible "zero diagnostics means it never ran" heuristic is wrong.

## The event+branch filter is runner-blind

A common CI-noise filter excludes failures whose `event` is `pull_request`/`merge_group`/`workflow_dispatch`, or whose branch isn't the default. What survives — `schedule` or `push` on `master` — gets treated as real signal. **That filter cannot see a per-runner fault.** A broken self-hosted node produces failures that pass every exclusion and look *maximally* real. On a self-hosted pool (`runs-on: [Windows, self-hosted, regression-test]`), ~1-in-N dispatches land on the bad box, so the workflow flickers red exactly like a genuine intermittent regression.

The cost, measured: "Nightly VKGLCTS broke after 7 green nights" was carried as a code-regression watch for four heartbeat reports. It was runner-scoped infra — node SLANGWIN5 could no longer resolve `slang.dll` after a VS 17.14→18.8 toolchain move on the box. The "next run decides transient vs regression" framing was also wrong: on a pool the next fire is a **lottery** — green means a healthy node, red means the bad one again, and *neither outcome carries information about the tree*. Treat a `schedule`-on-default-branch failure as unclassified, not real. [CI failure triage is runner-blind if you filter only on event+branch — check which node it landed on](../learnings/1785880778531-ci-failure-triage-is-runner-blind-if-you-filter-on.md)

## Attribute with a host × job cross-tab, not a list of reds

When several reds share a self-hosted runner, pull `runner_name` for *every* self-hosted job in the window and cross-tabulate **host × job × conclusion**. The defect is the single cell that is all-fail:

| job | SLANGWIN5 | SLANGWIN4 | SLANGWIN10X64-1 |
|---|---|---|---|
| `test-compile-regression` | **0 pass / 3 fail** | 5 / 0 | 2 / 0 |
| `test-benchmark` | 3 / 0 | 2 / 0 | 4 / 0 |
| `test-falcor` | 6 / 1 | 5 / 1 | 5 / 0 |

One table proves simultaneously: not a code regression (other hosts green on the same job), not a dead host (the bad host green on two other jobs), and job-scoped rather than host-scoped — the axis the remedy turns on (reprovision the tool vs. reboot the box). A list of reds proves none of these and invites "reboot the runner," which won't restore a missing binary.

Recipe: enumerate runs in the window, then per run `gh api -X GET repos/{o}/{r}/actions/runs/{id}/jobs -F per_page=100 --jq '.jobs[]|select(.runner_name!=null)|{name,runner:.runner_name,conclusion}'`, tally in a `collections.Counter` keyed on `(job, runner, conclusion)`.

Two traps: **(1)** A second signature on the same box tempts a shared-cause over-claim — but before promoting a shared root cause, check that the evidence for the cause is observable *on the job you are explaining* (the primary-defect job here set up no VS at all, so a toolchain-move story didn't apply to it — correlation is host-and-time, not mechanism). **(2)** Check whether the queue already re-dispatched before firing a requeue: a pooled-runner eviction can resolve itself inside one sweep, so read live `mergeQueueEntry` state and look for a newer `merge_group` run on the same `gh-readonly-queue/...` branch — the wake payload is a snapshot, and the world moves under it. [Attribute a runner-scoped CI defect with a host×job cross-tab, not a list of reds](../learnings/1785853592478-attribute-a-runner-scoped-ci-defect-with-a-host-jo.md)

## The figure correction is not a mechanism check

When you correct a carried *number*, separately re-check the carried *explanation*. They feel like one act; they aren't. A wrong figure looks wrong under scrutiny; a wrong mechanism looks fine because nothing in it is false. Concretely: "7 green nights then a break" was corrected 7→11 while the *same sentence* repeated the inherited "the runner changed, not the tree" mechanism — which was false (SLANGWIN5 ran 12/12 nights, the box never changed; the `vulkancts` label pins the workflow to one host). Three rules: **run the control especially when it's about to agree with you** (a confirming result is where the check gets skipped); fetch `runner_name` for *both* the green and red runs (constant box ⇒ streak-then-break *isolates* a change on that box, a stronger argument than a longer streak); and a "pool lottery, therefore uninformative" de-arm requires the pool to actually be a lottery — check host cardinality first. And **verify the target actually contains the error before correcting it** — the issue being "corrected" never contained the 7-green claim, so posting the fix would have put a false correction on a public issue. [A figure correction is not a mechanism check (CI streak attribution)](../learnings/1785882161001-a-figure-correction-is-not-a-mechanism-check-ci-st.md)

## The tree-identical control and the fleet base rate

Merge queues re-run the same content under different shas — a natural experiment holding code constant, varying host:

| commit | `.commit.tree.sha` | runner | spirv-val |
|---|---|---|---|
| `bf38d2a5b3` | `7c013124b46c` | SLANGWIN5 | 0/866 ❌ |
| `645ac5eef2` | `7c013124b46c` | SLANGWIN10X64-1 | 866/866 ✅ |

Byte-identical trees, opposite results, splitting only on host. Then get the fleet base rate (82 jobs / 4 days → SLANGWIN5 accounted for every failure across 5 unrelated branches). Bracket the transition (last success → first failure) to distinguish "host changed state" from "permanently broken." Traps: `skipped` is usually a *consequence* (a cancelled `needs:` dependency), not a path-filter decision — read the `needs:`/`if:` graph; your own next push destroys the previous sha's CI evidence (`cancel-in-progress` is true for `pull_request`); and for "did this job flip between two shas," pin the *job*, not latest-per-name. Also grep the workflow file for your failure signature before calling it novel — the project may have already documented it (the `JSON RPC failure` intermittency was commented in `ci.yml`). [A CI job failing 0/N while compilation passes N/N is a broken runner — find a tree-identical control pair](../learnings/1785876635240-a-ci-job-failing-0-n-while-compilation-passes-n-n-.md)

## Counting merge_group health: the gating workflow, not event=merge_group

One queue entry fans out to many runs (in shader-slang/slang, 7: `CI` plus six `Check*`). The non-gating ones are essentially always green, so a raw `event=merge_group` tally is dominated by noise:

```
raw tally, all workflows:  92 success / 6 fail / 2 cancelled  → looks ~94% healthy
gating `CI` workflow only:  7 success / 6 fail / 2 cancelled  → actually ~46% red
```

Tally the gating workflow *by name*, and report the **window span** (100 merge_group runs = ~32h, not a month). Classify flake vs regression from metadata without log access: spread-vs-clustered (6 failures across 6 distinct PRs can't be one regression); **re-queue outcome is the strongest single signal** (5 of 6 failing PRs merged hours later with no fix ⇒ flake); check `runner_name` per failing job including on greens. The habit worth keeping: **a stale "all clear" is as dangerous as a stale alarm.** Scope discipline gets applied when *arming* a watch but not when a reassuring number *ends* one — say the denominator out loud before a count closes a watch. [Counting merge_group CI health: tally the gating workflow by name, not event=merge_group](../learnings/1785899774910-counting-merge-group-ci-health-tally-the-gating-wo.md)

## Key a flake cost tally on the signature, never the host

A memory note claimed the SLANGWIN5 `spirv-val` defect cost "2 evictions"; a grep of the action log for `SLANGWIN5` returned 52 rows across 11 PRs — looking like a dominant infra offender. It wasn't: **two independent defects live on the same host.** Opening each run's job list showed 4 of the 11 were a *different* tracked flake (#12145 Falcor) merely scheduled on the same box. Verified count: 3, not 11. This matters because a cost figure drives prioritization — "SLANGWIN5 caused 11" points at *decommission the host*; "spirv-val caused 3, Falcor caused the rest" points at two fixes. The host name is a coincidence of scheduling, not a cause. **Confirm each event by re-opening the run's job list** — never a grep over free-text `reason` fields. Corollary: `check-ci` is a pure aggregator (its log lists every job with `name: conclusion`); if exactly one entry is `failure`, the eviction is 100% attributable to that job — cheap decisive attribution, but don't count `check-ci` as an independent failure. [Keying a CI flake cost tally on the RUNNER HOST over-counts when two defects share the box](../learnings/1785917535341-keying-a-ci-flake-cost-tally-on-the-runner-host-ov.md)

## A pass on a pooled resource measures the draw; a 0-success box is negative capacity

`runs-on: <label>` is a pool. A rerun cannot target a runner, so when one box is broken and you rerun a failed job, it may land on a healthy box and pass — **that pass is evidence about the box it landed on, not the defect.** The selection effect runs one way: successful escapes are invisible in PR-level pass/fail, so the pool always looks healthier than the bad box (SLANGWIN5 was 100% red / 6-of-6, while the 3-box pool looked ~26% red — a ~3× understatement). **Record which runner the job landed on before drawing any conclusion — on the FAILING attempt too**, captured at run time (the field is only readable while the log lives).

Part 2: don't concede a capacity cost you haven't measured. "Depooling reduces capacity" reasoned from box *count* is wrong. The bad box didn't fail fast (~10.6 min per failure, a full slot for zero return), occupied the pool during the contention it was blamed for, and each failure induced a rerun — a capacity *multiplier* on the downside. **A box with 0 successes is not 1/N of capacity; it is negative** — depooling removes 0 successful capacity and may *improve* throughput. The general form: "I measured a different object than the one my claim is about" — the pool label makes the substitution invisible, exactly as a `gh-readonly-queue/<base>/pr-N-<sha>` branch name does when the trailing sha is the base rather than the evicting merge commit. [A pass on a pooled resource is evidence about the draw, not about the fix — and a 0-success box is negative capacity, not a fraction of it](../learnings/1785941832757-a-pass-on-a-pooled-resource-is-evidence-about-the-.md)

## The Falcor #12145 crash code is emitted in DECIMAL only

The tracked Falcor flake (`test_GBufferRTTexGrads_d3d12`) is an access violation, so the natural probe is `grep -E '0xC0000005|access violation'` — which returns ZERO hits on a genuine occurrence. Falcor/Mogwai print only the decimal Win32 code: `exited with return code 3221225477` (== `0xC0000005`). The failure mode is asymmetric and self-concealing: the empty hex probe reads as "not #12145," so the triager attributes the failure to whatever *does* match — a false attribution born of a false negative. Detect by keying on the pair (both required): exact test name `test_GBufferRTTexGrads_d3d12` (NOT a bare `GBuffer` substring — siblings pass in the same batch) plus `return code 3221225477`. General lesson: **when a probe's EMPTINESS is load-bearing, test it against a known-positive control first — a numeric value can be printed in a different base than the issue title uses.** [Falcor #12145 crash code is emitted in DECIMAL only — a hex grep is a false-negative trap](../learnings/1785910460636-falcor-12145-crash-code-is-emitted-in-decimal-only.md)
