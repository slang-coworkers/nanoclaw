# A `cancelled` CI job is three different things — only arithmetic tells them apart

When triaging GitHub Actions CI, a job with `conclusion: cancelled` has **three** distinct causes, and the step log is **byte-identical** for all three (`##[error]The operation was canceled.`). The log text cannot discriminate — only the arithmetic can:

1. **Supersede / `cancel-in-progress`** — a newer commit killed the run. Benign no-op, never rerun. Tell: **ONE shared cancel timestamp** across all victims, and the head has moved.
2. **Infra cancel** — runner died or was reclaimed. Rerunnable. Tell: `runner_name: null`, or the job starts after a sibling that already finished.
3. **Per-job `timeout-minutes` expiry** — the job ran to its configured ceiling. This is a **legitimate cost regression, NOT a flake**; a rerun cannot fix it. Tell: **elapsed ≈ `timeout-minutes`**, and **N distinct cancel timestamps** (one per job, since each expires independently).

**Critical gotcha:** read `timeout-minutes` from the **reusable** workflow the job actually comes from, not the calling workflow. In shader-slang/slang, `ci.yml` has its own `timeout-minutes: 10` belonging to an unrelated analytics job; the real ceilings live in `ci-rhi-test-container.yml` (30), `ci-rhi-test.yml` (50), and `ci-slang-test.yml` (80). Grepping the caller gives you a number that matches nothing.

**Worked example (shader-slang/slang#12354, 2026-08-08).** Attempt 2 bucketed as 31 success / 1 failure / 4 cancelled / 1 skipped. The lone `failure` was `check-ci`, a pure aggregator that exits 1 merely because 4 `needs` entries reported `"result": "cancelled"` — so there were **zero genuine job failures**, the shape that most strongly invites "benign, move on." But the four elapsed times were 30.0 / 50.1 / 50.2 / 80.2 min against ceilings of 30 / 50 / 50 / 80, at four *different* timestamps (00:08:12 / 00:30:40 / 01:10:50 / 01:40:49Z). Four independent expiries, not one cancel signal.

Two controls turned "slow runner" into "code defect":
- **Within-branch, same head:** attempt 1 hit the same two timeouts (30.1 / 50.3 min) → reproducible.
- **Cross-PR, same 4 jobs, 7 control PRs:** 28/28 job-runs green with medians 6.8 / 5.6 / 5.0 / 30.1 min → a **4.4×–14.3× cost blowup local to that branch**, traceable to `-DSLANG_ENABLE_VALIDATION_FOSSIL=ON` + `-DSLANG_ENABLE_VALIDATION_FULL_IR=ON`, which the PR added **unconditionally** to the shared `ci-slang-build.yml` (3 sites) that every build job calls.

**Why this matters beyond one PR:** bucketing by `conclusion` alone **splits one defect into two labels** — the same validation-flag cost blowup previously surfaced as an RPC-channel drop (classified "flake") and now as `cancelled` (classified "benign"). Both readings bias toward *inaction*, so nothing contradicts them; the cost only reappears later as an unexplained red on someone else's PR. If you see `cancelled` jobs, compute elapsed-vs-ceiling before calling it benign.
