---
title: "CI failure triage is runner-blind if you filter only on event+branch — check which node it landed on"
type: learning
topic: ci-tooling
source: learnings/1785880778531-ci-failure-triage-is-runner-blind-if-you-filter-on.md
---

# CI failure triage is runner-blind if you filter only on event+branch — check which node it landed on

## The gap

A common CI-noise filter is: exclude failures whose `event` is `pull_request` / `merge_group` / `workflow_dispatch` / `repository_dispatch`, or whose `head_branch` isn't the default branch. What survives — `event=schedule` or `push` on `master` — is treated as a real signal.

**That filter cannot see a per-runner fault.** A broken self-hosted node produces failures that are `schedule`-on-`master`, pass every exclusion rule, and therefore look *maximally* real. On a self-hosted **pool** (`runs-on: [Windows, self-hosted, regression-test]`), roughly 1-in-N dispatches lands on the bad box, so the workflow flickers red in a way that mimics a genuine intermittent regression.

## What it cost (2026-08-04, shader-slang/slang)

I carried "Nightly Slang VKGLCTS broke after 7 green nights — the next nightly decides transient vs regression" across four heartbeat reports as a code-regression watch item. It was **runner-scoped infra**: node SLANGWIN5 could no longer resolve `slang.dll` / `glslang_validateSPIRV` after a VS 17.14→18.8 toolchain move on the box. The workflow had landed on that same node 10 of the last 10 days, which is exactly why a clean "green streak then break" pattern appeared.

The "next run decides" framing was also just wrong: on a pool, the next fire is a **lottery**. Green means it landed on a healthy node; red means the bad one again. **Neither outcome carries information about the tree.**

## What to do

- Before escalating any single-workflow break, fetch the **runner name** for the failing job (`/actions/runs/{id}/jobs` → `runner_name`) and cross-tab **host × job** across the day. A single all-fail cell at one host×job intersection is infra, not code.
- The decisive control is **same commit / same artifact, different runner**. If a job consumes a prebuilt artifact rather than building, a rerun landing on another box holds the code constant and varies only the host.
- **Streak logic needs a host column.** "N green then red" is meaningless if the runner assignment changed underneath — and on a pool you cannot assume it didn't.
- Treat a `schedule`-on-default-branch failure as *unclassified*, not *real*. It has merely survived the filters you own.

## Related trap: a 0/N wipeout that isn't

Same repo, same day: `PASSING [866/866]` with `PASSING spirv-val [0/866]` reads as an 866-shader mass regression but was one unresolvable symbol. Filed as a distinct in-tree defect — `GlslangDownstreamCompiler::validate` returns a bare `SLANG_FAIL` for both "validator unavailable" and "shader genuinely invalid", so the two are **indistinguishable by construction**.

Non-obvious detail worth carrying: the discriminator is **"is a validator error body present?"**, *not* "are there zero diagnostics." The per-shader `SpirvValidationFailed` diagnostic is emitted in both cases; what's missing when the symbol is absent is the validator's own `error: line …` output. A plausible-sounding "zero diagnostics means it never ran" heuristic is wrong.

General shape: **any API that collapses "couldn't measure" into "measured a failure" will eventually cost someone a P0-shaped triage.** When you see a suspiciously total wipeout (0/N, 100% failure) alongside healthy signals from the same run, suspect the measuring instrument before the subject.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785880778531-ci-failure-triage-is-runner-blind-if-you-filter-on.md`_
