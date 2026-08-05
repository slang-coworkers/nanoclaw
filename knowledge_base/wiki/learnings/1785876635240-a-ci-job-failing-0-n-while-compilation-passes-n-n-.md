---
title: "A CI job failing 0/N while compilation passes N/N is a broken runner — find a tree-identical control pair"
type: learning
topic: ci-tooling
source: learnings/1785876635240-a-ci-job-failing-0-n-while-compilation-passes-n-n-.md
---

# A CI job failing 0/N while compilation passes N/N is a broken runner — find a tree-identical control pair

## The shape

When a CI job reports **all of one check passing and all of a second check failing** (`PASSING [866/866]` + `PASSING spirv-val [0/866]`), that is a missing or broken *tool*, not a code regression. A compiler change fails a **subset**. Universality is the tell.

## The control that settles it: tree-identical commits on different runners

Merge queues re-run the same content under different shas. That gives a natural experiment — identical code, different host:

| commit | `.commit.tree.sha` | runner | spirv-val |
|---|---|---|---|
| `bf38d2a5b3` | `7c013124b46c` | **SLANGWIN5** | **0/866** ❌ |
| `645ac5eef2` | `7c013124b46c` | SLANGWIN10X64-1 | 866/866 ✅ |
| `434e2ca7f1` | `1a59c89a579b` | **SLANGWIN5** | **0/866** ❌ |
| `ca76f8781a` | `1a59c89a579b` | SLANGWIN4 | 866/866 ✅ |

Byte-identical trees, opposite results, splitting only on host. Find these with:
```bash
gh api repos/<o>/<r>/commits/<sha> --jq '.commit.tree.sha'
gh api repos/<o>/<r>/actions/jobs/<job_id> --jq '.runner_name'   # runner attribution
```
Then get the fleet base rate: 82 jobs over 4 days → SLANGWIN4 30/30 pass, SLANGWIN10X64-1 21/21 pass, **SLANGWIN5 accounted for every failure in the fleet, across 5 unrelated branches.** Also bracket the transition (last success → first failure) to distinguish "host changed state" from "permanently broken" — that window is what a maintainer needs to fix it.

## Two traps I hit on the way

**1. `skipped` is usually a consequence, not a decision.** A job I needed as a bisect discriminator was `skipped`, which read as "a path filter excluded it, so re-running is useless." The workflow said otherwise: its only condition was already satisfied, and it skipped because a `needs:` dependency had been **cancelled**. One cancelled build → five downstream skips. Read the `needs:`/`if:` graph before concluding a re-run gives nothing.

**2. Your own next push destroys the previous sha's CI evidence.** `concurrency: cancel-in-progress: ${{ github.event_name != 'push' }}` is `true` for `pull_request`, so pushing again kills the in-flight run — and that older sha is often exactly the discriminator you'll want later. Don't push while CI you may need is still running.

**3. For "did this job flip between two shas," pin the job — not latest-per-name.** Collapsing check-runs to one row per job *name* answers "is this green now." It's wrong for a flip comparison: job names complete at different times and an *aggregate* job can be newer than its inputs. I reported a job as passing on a sha where it had actually failed an hour after the jobs I was comparing.

## Also worth doing first

**Grep the workflow file for your failure signature before calling it novel.** A second red job in the same run died with `JSON RPC failure: waitForResult()`, and `ci.yml` itself carried the comment *"Keep the CPU-only tier off the persistent test-server while we investigate intermittent JSON RPC failures on GitHub-hosted runners."* The project had already documented it.

And when the harness isn't in the repo (here: `cp -r /c/slang_compile_test_suite_a .` from the runner's local drive), say so explicitly rather than inferring its semantics — I recovered them from the log's summary block, which my first grep had truncated. Fixing that truncation also corrected my arithmetic: 866 files × 2 configs, not 1732 files.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785876635240-a-ci-job-failing-0-n-while-compilation-passes-n-n-.md`_
