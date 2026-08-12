# A CI deadline is a carried value — every push voids it, and a 403 is not "no rule"

Three related traps hit in one session on shader-slang/slang draft PR #12014 (priority-yield CI). All cheap to avoid once named.

## 1. `gh workflow run` RESETS the yield clock; `gh run rerun` does not

For a yielded bot CI run, recovery is **`gh run rerun <id>`, NOT a fresh `gh workflow run`**.

`extras/ci/ci_priority_common.py::run_age_hours` uses `created_at`, documented in-source to stay fixed across reruns (only `run_started_at`/`run_attempt` change). So:
- **rerun** → inherits the aged `created_at` → trips `escalated` in `wait-for-priority.py` (`escalated = yielded and self_age_hours >= max_yield_hours`, `ci.yml` passes `--max-yield-hours 12`) → **proceeds despite contention**.
- **fresh dispatch** → `created_at` resets → logs `age 0.0h` → yields again for up to another 12h.

Two windows, and it matters which one you cite:
- **12h** (`--max-yield-hours`) triggers *nothing on its own*; it only changes the decision inside a run that actually executes.
- **16h** (`retry-yielded-bot-ci.py --lookback-hours 16`) is the window that **expires the run unrerun** — after it, the automatic selector stops considering the run at all.

Also: `retry-yielded-bot-ci.py` returns at its quiet check *before* candidate selection, so there is **no aged-run bypass**. It can log `CI is still active (N run(s)); not rerunning bot CI.` indefinitely while your run ages out.

## 2. A derived deadline is a carried value — re-derive it after anything that changes its basis

I derived the 12h/16h deadlines three times in one session because I pushed twice, and each push created a new run with `age 0.0h`, silently voiding every timestamp and run ID I had just computed. A stale deadline reads exactly like a fresh one.

Fix: derive **after** your last push, or write the basis commit/run-id next to the deadline so it can't be read out of context. Better, for any line recording a mutable head: store the **re-derivation command** beside the value (`git ls-remote origin refs/heads/<branch>`), not just the sha. I wrote a "current head" line twice and got it stale twice — the second time inside the very warning about staleness.

## 3. A 403 is not "no rule" — don't assert a negative from a blind instrument

I wrote "I found no branch rule requiring up-to-date status." But `gh api repos/<owner>/<repo>/branches/master/protection` returns **403 `Resource not accessible by integration`** for a GitHub App token. The instrument cannot see branch protection at all, so it can never produce evidence of absence. Report it as *"cannot verify; API returns 403"*.

Related miscount the same round: I said three higher-priority runs were blocking, from eyeballing `in_progress`/`queued` — the log had **four**, and I'd silently dropped the one in state `waiting`. `grep -c "Yielding to human/merge CI"` gives the real count. Count with the instrument; don't tally by eye across categories you happened to enumerate.

## Bonus: `git fetch origin <branch>` can exit 0 and leave the tracking ref STALE

If the clone's refspec is master-only (`+refs/heads/master:refs/remotes/origin/master`), `git fetch origin fix/issue-N` updates only `FETCH_HEAD` — `origin/fix/issue-N` stays at its old value, exit code 0. I nearly reported a stale head as live. **`git ls-remote` is the authoritative read.** Symptom looks identical to the two-repos/two-mounts trap; distinguish with `git rev-parse --show-toplevel` + `--git-common-dir` before theorizing.
