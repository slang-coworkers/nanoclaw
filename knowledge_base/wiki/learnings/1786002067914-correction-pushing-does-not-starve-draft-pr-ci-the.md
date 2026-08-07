---
title: "CORRECTION: pushing does NOT starve draft-PR CI — the blocker is `any_active_ci`, and `waiting` counts as active"
type: learning
topic: ci-tooling
source: learnings/1786002067914-correction-pushing-does-not-starve-draft-pr-ci-the.md
---

# CORRECTION: pushing does NOT starve draft-PR CI — the blocker is `any_active_ci`, and `waiting` counts as active

**Corrects my earlier note "Pushing to a draft slang PR starves its own CI — each dispatch disqualifies the previous yielded run from retry" (2026-08-06). The mechanism in that note is WRONG. `append_learning` is immutable, so this is the correction; prefer this one.**

**What I got wrong.** I claimed `has_newer_run_for_branch()` in `extras/ci/retry-yielded-bot-ci.py` means each new dispatch disqualifies the previous yielded run, so iterating quickly starves the retry — and therefore "responding promptly to review starves the CI you're waiting for." I read the function correctly. **The causal conclusion does not follow:** the check compares candidates *within a branch*, so a branch's **newest** dispatch always survives it. The function eliminates stale runs and is structurally incapable of producing zero candidates. Going quiet on the branch buys nothing.

**The actual constraint is one function earlier.** `main()` calls `any_active_ci(fetch_active_runs(...))` and **returns before candidate selection is ever reached**. Measured over 12 consecutive fires of the retry workflow, reading each job's own printed verdict:

| printed verdict | fires |
|---|---|
| `CI is still active (N run(s)); not rerunning bot CI.` | **12 / 12** |
| `No yielded bot CI runs are eligible for rerun.` ← the branch I blamed | **0** |

The code path I described **never executed**. And `ACTIVE_STATUSES` includes **`waiting`**, with the active-run query scoped to the whole repo's `ci.yml` (no branch filter) — so **one run parked on a manual environment approval suppresses bot retries repo-wide** until a human clicks. In the observed case that was a `test-falcor` job waiting on the `falcor-ci` environment, parked ~2.45 h.

**So the accurate picture for a draft bot PR with no CI signal:**
1. A draft gets no `pull_request` CI by design (`ci.yml`'s `filter` job is gated on `draft != true`) — hence the manual-dispatch rule.
2. Manual dispatches yield while higher-priority CI is active (`priority-gate-yielded`).
3. The retry that would rerun them is blocked whenever *any* repo CI run is active, `waiting` included.
⇒ Nothing about your push cadence is the lever. Don't hold work back for it.

⭐ **The reusable lesson, and it's the sharper half: I reached for source when the tool had already written the answer.** The retry job **prints its verdict on every fire**. One `gh run view --log` would have discriminated between "no eligible candidates" and "returned early on active CI" in seconds. **Source tells you what *could* happen; the log tells you what *did*.** When a scheduled job has a decision to explain, read its log before theorising from its code — and specifically ask *does the branch I'm blaming ever execute?*

Generator, same as several other errors in that session: **read the condition that supports the claim, stop, then describe the system.** The local read was right; the scope statement built on it wasn't.

⚠️ Two figures from the original note also need correcting: there were **five heads but only four `workflow_dispatch` runs** (`3359a638e8` has `workflow_dispatch=0`, verified per-SHA via `actions/runs?head_sha=`), so the "byte-identical amend reset a window six minutes later" story describes a window that never existed. The *enumeration* caveats in that note still stand and are worth keeping: `gh run list --branch` cannot see amended-away SHAs, and `statusCheckRollup` can report 0 failing while `commits/<sha>/check-runs` reports 2.

**Fast path to real CI on a bot PR, measured:** a non-draft bot PR takes the `IS_THROTTLED_BOT != true` path and does not yield — an observed ready-for-review bot PR had `wait-for-human-priority: success` with 36 non-skipped jobs including Windows/macOS/aarch64/sanitizer. That flip is human/operator-gated; don't push to work around it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786002067914-correction-pushing-does-not-starve-draft-pr-ci-the.md`_
