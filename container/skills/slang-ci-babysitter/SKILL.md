---
name: slang-ci-babysitter
license: MIT
description: "Sweep shader-slang/slang CI for stuck or failed runs on open PRs and wake only when a non-draft PR needs a rerun or an eviction decision."
provides: []
allowed-tools: Bash, Read
---

# slang-ci-babysitter

The sweep is `scripts/sweep-gate.mjs`, the pre-task gate of the babysitter's two-hourly task. It reads the open PRs and their check runs with `GH_TOKEN`, classifies stuck, flaky and blocked runs, decides whether any of it needs the agent, and prints the gate JSON as its last line.

## What wakes the agent

The gate wakes only on something the sweep can act on. `decideWake` in the script is the single rule; each hit becomes an entry in `data.wakeReasons` (`{number, reason, ...}`):

- `failing-unexcluded`: a selected PR has a failing check that neither the tracked-regression ledger nor the base-skew registry explains (`actionableFailingChecks` non-empty). It fires on every sweep while the check stays red; the agent's rerun tracker bounds how often it actually reruns.
- `rollup-unexplained`: a full-scan entry's rollup is non-green and nothing in the payload accounts for it.
- `newly-blocked`: a check stalled on a human (approval gate, `action_required`) that was not blocked on the previous sweep. An unchanged blocked check does not wake again.
- `tracked-head-changed` / `tracked-failures-cleared`: a PR the gate reported on last time has a new head, or its failures went away on the same head, so the agent can close out what it recorded.
- `evicted-from-merge-queue`: a merge-group eviction in the last 24 h whose failing jobs are unexplained (or could not be fetched), once per eviction run id.
- `deployment-drift` and `evicted-scan-error`: the script is running stale source, or the eviction scan itself failed; both stay loud until fixed.

A sweep that throws wakes with `{"wakeAgent": true, "data": {"error": …}}` so a broken gate is never silent.

## Output

Awake: `{"wakeAgent": true, "data": {"driftCheck": …, "prs": […], "evicted": […], "wakeReasons": […], …}}` — the full per-PR payload plus the reasons.

Asleep: `{"wakeAgent": false, "data": {<counts only: totalNonDraft, prCount, prsWithFailures, prsAllFailuresExcluded, prsWithBlockedChecks, evictedCount, trackedPrs, …>}}`.

## State

The gate keeps `/workspace/agent/memory/ci-babysitter/sweep-gate-state.json`, written atomically on every sweep: `{version, updatedAt, prs: {<number>: {headSha, failing, blocked, rollupUnexplained}}, evictedRunIds}`. Only PRs with something to track (failing, blocked or unexplained) have an entry; a green PR drops out. A missing or unreadable file means every blocked check and eviction counts as new on the next sweep, which costs one extra wake and never a missed one. The ledgers it reads live beside it: `tracked-regressions.json` (do-not-rerun, self-heals when the tracked issue closes) and `base-skew-signatures.json`.

## Testing

`node --test 'container/skills/slang-ci-babysitter/scripts/*.test.mjs'` runs the decision suite (`sweep-gate.test.mjs`), which drives `decideWake` with fixture payloads and no network. Importing the script does not run the sweep; only `node sweep-gate.mjs` does. To test a change against live data, run the same command inside the babysitter's container and check that the last line is valid JSON.

The task row is only `# nanoclaw-task-timeout: 180` and `exec node /app/skills/slang-ci-babysitter/scripts/sweep-gate.mjs`; the program lives here so it is reviewed and versioned like any other code.
