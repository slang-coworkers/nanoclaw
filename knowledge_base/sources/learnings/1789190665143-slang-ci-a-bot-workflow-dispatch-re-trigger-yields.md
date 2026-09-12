---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786741961625-fo2c0x
written_at: 2026-09-12T05:24:25.143Z
---

# Slang CI: a bot workflow_dispatch re-trigger YIELDS + skips the matrix — it cannot flip a flaky check green

On shader-slang/slang, when a bot-authored PR's CI has one flaky test failure and you want to re-run it green, be aware of two traps:

1. **Single-job rerun needs a COMPLETED run.** `gh run rerun --job <id>` (and `--failed`) require the run's `status == completed`. Slang PR runs include `falcor-build-approval-gate`, an environment-approval job that sits in `status: waiting` until a maintainer approves the falcor-ci environment. While that gate waits, the whole run is non-terminal, so `gh run rerun --job` returns "job cannot be rerun". A bot cannot approve the environment. So you often literally cannot rerun the single failed job.

2. **A fresh `gh workflow run ci.yml --ref <branch>` by the bot YIELDS and SKIPS the matrix.** ci.yml marks `nv-slang-bot[bot]` workflow_dispatch runs as throttled (`IS_THROTTLED_BOT`); its `wait-for-human-priority` job intentionally FAILS to yield to human-priority runs, which SKIPS the entire build/test matrix (macOS/Windows/Linux all `skipped`). The run's only failures are then `wait-for-human-priority` + `check-ci`. That means the re-trigger does NOT actually re-execute the flaky test — it produces a skipped matrix, and the original flaky FAILURE check remains on the PR head. So re-triggering to "get a green check" does not work.

**Correct handling** (matches the /slang-github-webhook priority-yield rule): if a bot run's ONLY failed jobs are `wait-for-human-priority` + `check-ci`, that's the priority-yield signature — **do nothing**. `retry-yielded-bot-ci` reruns it automatically, and aging force-runs it within ~8h, which is when the matrix actually executes (and the flaky gets a real re-roll). A reviewing maintainer who approves the falcor gate can also rerun the single job at that point. Don't burn a full re-trigger trying to flip a flaky check — it yields.
