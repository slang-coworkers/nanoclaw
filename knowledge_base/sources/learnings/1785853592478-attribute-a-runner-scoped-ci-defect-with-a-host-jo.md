# Attribute a runner-scoped CI defect with a host×job cross-tab, not a list of reds

## The move

When several CI reds share a self-hosted runner, don't reason from a list of failures. Pull
`runner_name` for **every** self-hosted job in the window and cross-tabulate **host × job ×
conclusion**. The defect is the single cell that is all-fail.

Observed 2026-08-04 on shader-slang/slang:

| job | SLANGWIN5 | SLANGWIN4 | SLANGWIN10X64-1 |
|---|---|---|---|
| `test-compile-regression` | **0 pass / 3 fail** | 5 / 0 | 2 / 0 |
| `test-benchmark` | 3 / 0 | 2 / 0 | 4 / 0 |
| `test-falcor` | 6 / 1 | 5 / 1 | 5 / 0 |

One table simultaneously proves: not a code regression (other hosts green on the same job), not a
dead host (SLANGWIN5 green on two other jobs), and job-scoped rather than host-scoped — which is the
axis the remedy turns on (reprovision the tool vs. reboot the box). A list of reds proves none of
these; it invites "reboot the runner", which would not restore a missing binary.

Recipe: enumerate runs in the window, then per run
`gh api -X GET repos/{o}/{r}/actions/runs/{id}/jobs -F per_page=100 --jq '.jobs[]|select(.runner_name!=null)|{name,runner:.runner_name,conclusion}'`,
and tally in a `collections.Counter` keyed on `(job, runner, conclusion)`.

## Two traps this run

**1. A second signature on the same box tempts an over-claim.** SLANGWIN5 also failed the nightly
VKGLCTS job with `failed to load slang.dll` (11545/13792 vs 0/13792 the previous day), and that log
revealed the box had been upgraded `VSCMD_VER 17.14.19` (VS 2022) → `18.8.2` (VS 18). Both signatures
are "a freshly built binary can't resolve a DLL/symbol", so a shared toolchain cause is attractive —
but the job carrying the primary defect (`test-compile-regression`) **sets up no VS at all**
(`grep -icE 'vcvarsall|VSCMD'` → 0 in both its green and red logs). So the correlation is
host-and-time, not mechanism. Before promoting a shared root cause across two signatures, check that
the evidence for the cause is observable **on the job you are explaining** — otherwise label it a
hypothesis and state what would falsify it.

**2. Check whether the queue already re-dispatched before firing a requeue.** A merge-queue eviction
caused by a pooled-runner lottery can resolve itself inside one sweep: the queue re-dispatched the
evicted PR 1h37m later, the retry landed on a healthy box and went green, and `mergeQueueEntry` read
`AWAITING_CHECKS position 1`. A requeue on top of that is thrash. Read live queue state
(`mergeQueueEntry`) **and** look for a newer `merge_group` run on the same `gh-readonly-queue/...`
branch before acting on an eviction reported by a wake payload — the payload is a snapshot, and for a
pooled defect the world moves under it.
