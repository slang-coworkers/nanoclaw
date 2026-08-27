# Deployed-closure verification — F01, F06, F07, F08, F10

Verified: 2026-08-10
Scope: the five audit findings still marked **Closed** in
[`OPUS_CLOSURE_AND_PROD_GO_NO_GO_2026-08-07.md`](../OPUS_CLOSURE_AND_PROD_GO_NO_GO_2026-08-07.md)
after F04 and F14 were demoted.
Method: read-only inspection of both deployed boxes. **No mutations of any kind.**

## Verdict

**All five are `inert-in-prod`. None is `not-closed`. One common cause.**

Neither deployed tree contains any of the five fixes. Every closure commit merged on
**2026-08-06 between 13:19 and 14:19 UTC**; prod's deployed HEAD is dated
**2026-08-05 08:46 UTC** (~29 h earlier) and lego's is **2026-08-06 10:38 UTC**
(~2.7 h earlier). Both predate all six commits.

This is a **deploy** problem, not a code problem. It routes to whoever owns the prod
deploy, not to the authors of the fixes. I did not re-audit whether the fixes are
*correct* — that was the audit's job, and its own recorded residuals stand (F10
"residual P2"; F01's separate `#1134` blocker).

### A third status did emerge, and it matters

The brief anticipated `inert-in-prod` vs `not-closed`. A third is needed:

> **`inert-and-actively-miscomputing`** — the fix is absent *and* the defective
> pre-fix code is still on a cron, still writing the artifacts people read.

F08 and F10 are in that state. F01, F06 and F07 are merely dormant. The distinction
changes urgency: for F08/F10 the behaviour each finding describes is live in numbers
currently on the dashboard.

| Finding | Closure PR(s) | Verdict | Prod evidence |
|---|---|---|---|
| **F01** — Codex image release-age / lock reproducibility | #1118, #1132 | `inert-in-prod` | `scripts/check-release-age-policy.sh` **absent**; `container/install-cli-tools.sh` quarantine markers **0** |
| **F06** — duplicate approval event joins wrong decision | #1110 | `inert-in-prod` (**observed**, not presence-only) | `approval_decisions` has **no `provenance`, no `verdict_source`, no `verdict_source_event_id`**; migrations 934/935 **never applied**; 252 rows |
| **F07** — regression quality publishes confident zeroes | #1107 | `inert-in-prod` | `scripts/regression-quality.py` **does not exist**; no regression-quality artifact in `reports/` |
| **F08** — review cost undercounts, cron lies | #1106 | `inert-and-actively-miscomputing` | `scripts/funnel-metrics.ts` **does not exist**; `funnel-cron.sh` (Jul 26) lacks `run_step()`; **cron runs it every 30 min**; `reports/funnel.json` rewritten 2026-08-10 06:09 |
| **F10** — KB health drops evidence / overwrites history | #1124 | `inert-and-actively-miscomputing` | `kb-health.py` present but pre-#1124 (`write_atomic` 0, `admits` 0); `kb-doctor.py` **absent**; **cron runs kb-health 05:45 daily**; `KB-HEALTH.md` + `.kb-health.json` rewritten 2026-08-10 05:45 |

## Ground truth per surface, as established (not assumed)

The brief asked me to verify these rather than take them on trust.

**The inspected checkout is the running tree.** Not inferred from the unit file alone:

```
MainPID              2984341
/proc/2984341/cwd →  /home/ubuntu/slang-coworkers-prod/nanoclaw
cmdline              /usr/bin/node /home/ubuntu/slang-coworkers-prod/nanoclaw/dist/index.js
WorkingDirectory     /home/ubuntu/slang-coworkers-prod/nanoclaw
```

`find ~ -maxdepth 3 -type d -name nanoclaw` returns only that checkout and
`~/.config/nanoclaw` — there is no second tree the host could be running instead.

**host `src/` → `dist/`.** Build and restart are consistent with each other
(`dist/index.js` mtime 2026-08-05 08:46:22, unit `ActiveEnterTimestamp` 08:46:25), so
the deployment is *internally* coherent — it is simply a build of a checkout that never
contained the fix. `src/modules/approval-ledger/` holds only `index.ts`, `store.ts`,
`store.test.ts`: no `capability.ts`, no `guard.ts`. `APPROVAL_LEDGER_WRITERS` appears
nowhere under `dist/`.

**host `scripts/`.** Live as soon as the checkout moves — and it has not moved.

**installed cron.** `crontab -l` on prod:

```
*/30 * * * * .../scripts/funnel-cron.sh                       ← pre-#1106, runs every 30 min
45 5  * * * cd ... && python3 scripts/kb-health.py --json-only ← pre-#1124, runs daily
```

**container image.** All `nanoclaw-agent:*` images predate or were built from this
checkout, so #1118/#1132 cannot be in any of them.

## F06 — why this one is an observation, not a presence check

The F06 fix works by filtering joins to trusted provenance. That mechanism reads a
column. Prod's `approval_decisions` schema is:

```
repo, pr_number, commit_sha, mode, decision, reason_code, review_diff_hash,
policy_version, clauses_json, challenger_json, human_verdict, agent_group_id,
session_id, thread_id, decided_at, join_mode
```

No `provenance`. The last applied migration is `approval-join-mode` (931); 934
(`approval-decision-provenance`) and 935 (`approval-decisions-quarantine-legacy`) have
never run. So the fix is not merely absent from disk — **the filter it performs cannot
be operating**, and all 252 existing rows remain structurally unattributable. That is
the behavioural bar the brief asked for, met without causing anything on prod.

## Lego is not a fallback

Lego (`slang-cpu-coworkers`, `~/haaggarwal/lego-nanoclaw`) does **not** have these
fixes either — HEAD `40cff931`, 2026-08-06 10:38 UTC, ~3 h before the earliest closure.

⚠️ **Do not read lego's `git rev-list --count HEAD..origin/nv-main` as 0-behind.** It
reports 0, but its `origin/nv-main` ref was last fetched 2026-08-06 10:29 — *before* the
closures. The count is measured against a stale ref. Prod's self-reported "119 behind"
has the same defect (last fetch 2026-08-05 14:51), so **119 is a floor, not the
distance.** Both deployed HEADs (`40c519caa` prod, `40cff931` lego) are box-local
commits absent from the shared clone, so the true distance cannot be computed from a
developer machine at all.

## Incidental, confirmed while here

- **Task #36 independently confirmed.** Prod's crontab has **no `kb-doctor` entry** and
  **no `MAILTO`** — the fail-loud exits notify nobody.
- `reports/.funnel-gh-cache.json` on prod is **124 MB**.
- `~/.config/nanoclaw/funnel-cron.log` does not exist, so the 30-minute funnel job's
  output is not being retained anywhere.

## Method note — one marker was wrong, and would have produced a false result

`countHumanReview` appears on added lines in #1106's diff and looks like a natural
marker for F08. It is not: `git show 55bd2305d^:scripts/funnel-metrics.ts` shows it
**pre-existed** the fix. Using it would have reported lego as partially carrying F08.

Every marker below was validated against its closure commit's **parent** before use:

| Finding | Marker used | Present in parent? |
|---|---|---|
| F01 | `scripts/check-release-age-policy.sh` | absent ✓ |
| F06 | `src/modules/approval-ledger/capability.ts` | absent ✓ |
| F07 | `def culprits_for` | 0 ✓ |
| F08 | `function diskCacheTtl`, `run_step()` | 0, 0 ✓ |
| F10 | `def write_atomic` | 0 ✓ |
| — | ~~`function countHumanReview`~~ | **1 — rejected** |

## What this does not establish

- **Not** that the five fixes are correct. Only that they are not running.
- **Not** the true commit distance of either box (stale refs; box-local HEADs).
- **Not** anything about the other twelve findings.
- Nothing was proven by causing behaviour on prod. Where a behaviour could only be
  observed by triggering it, I established schema/artifact state instead and said so.

## Suggested next step (owner's call, not mine)

The five findings need no code work. They need prod deployed, and then a re-check —
the same probes, expecting the markers to flip. Until then the closure ledger should
read `merged, not deployed` for all five rather than `Closed`.
