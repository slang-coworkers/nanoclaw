---
name: project_nanoclaw_1131_cron_failure_visibility
description: "nanoclaw#1131 (szihs, OPEN 08-06) adds scripts/cron-run.sh + 27-assertion suite so a nonzero cron exit leaves a marker. Reviewed INLINE (no nanoclaw approver — ~26th instance), comment 5206016814. All 3 mutant counts reproduced EXACTLY (8/15/1). 3 🟠: same-job RMW lost updates REFUTE the PR's 'no race to get wrong'; unsanitized $JOB path component fails SILENT; cited dashboard/server.ts is on nv-dashboard NOT the nv-main base, and no consumer exists yet."
metadata: 
  node_type: memory
  type: project
  originSessionId: 1e5306c7-f9bf-4985-ae78-4bbfff6a277c
---

# nanoclaw#1131 — `cron: make a nonzero exit from a scheduled job impossible to miss`

**ROUTING: handled INLINE by Main.** `slang-coworkers/nanoclaw` has no `nanoclaw-pr-approver`;
`slang-pr-approver`/`slangpy-pr-approver` are repo-scoped to the compiler repos ⇒ `ABSTAIN_POLICY`.
See [[project_nanoclaw_pr874_webhook_route_approver]].

**State:** OPEN, head `7e7dd484649ef89fc71096882b5021417317471c`, `fix/nv-main/cron-failure-visibility`
→ `nv-main`, 2 new files +266/-0 (`scripts/cron-run.sh` 139L, `scripts/test-cron-run.sh` 127L).
CI `check`/`ci`/`label` all pass. Verdict **LGTM + 3 🟠**, review posted as
[comment 5206016814](https://github.com/slang-coworkers/nanoclaw/pull/1131#issuecomment-5206016814).
Author says "Not merging" — maintainer owns merge.

**Write path (confirms [[feedback_gh_pr_comment_and_rest_comments_are_different_verbs]]):**
`gh api repos/slang-coworkers/nanoclaw/issues/1131/comments -X POST -F body=@file` → id 5206016814 ✓.
Did not attempt `gh pr comment` (known-denied verb for this App on this repo).

## Differential confirmation — all four figures matched

Fetched both files by **SHA** (branch-name ref 404s: `gh api …?ref=fix/nv-main/…` → *"No commit
found for the ref"*; `?ref=<sha>` works) and executed them:

| what | PR claimed | measured |
|---|---|---|
| suite | 27 assertions | `PASS 27 FAIL 0` |
| mutant: trailing `tail`/`mv` after exit | 8 fails, `expected rc=42, got rc=0` | `PASS 19 FAIL 8`, signature present verbatim |
| mutant: `$(date)` between cmd and `RC=$?` | 15 fails | `PASS 12 FAIL 15` |
| mutant: never clear marker on success | 1 fail | `PASS 26 FAIL 1` |

⭐ **The mutant table is real evidence** — appending a log rotation as the true last statement
collapses 7 rc assertions to 0, so the `exit "$RC"`-is-last invariant is genuinely pinned, not
merely asserted. First `sed`-based M1 attempt failed to remove the exit line (left both present,
suite still showed 19/8 for an unrelated reason) — **redid it in python asserting the file ends with
`exit "$RC"` before splicing**. A mutant you haven't verified actually mutated proves nothing.

## The three 🟠 (all CONSTRUCTED, not reasoned)

1. **Same-job RMW lost updates refute the PR's own invariant.** PR: *"Per-job files have a single
   writer each, so there is no race to get wrong."* Per-job files remove **cross-job** contention
   only. Seeded 1 failure then ran 8 concurrent same-job failures → `consecutiveFailures=6`, not 9
   (3 lost updates). `os.replace` keeps it parseable, so lost-count not torn-file. Worse: slow
   success overlapping a failure, 4 trials → marker **ABSENT on 2 of 4 while the job was failing** —
   the exact silent-failure state the wrapper abolishes. Low practical exposure (daily jobs need a
   ~24h overrun to overlap) ⇒ 🟠 not 🔴; the defect is the *claim*, not the risk.
2. **`$JOB` is an unsanitized path component and fails SILENT.** `cron-run.sh '../../OUTSIDE/pwned'`
   wrote outside STATE_DIR (rc=3 still correct); `'nested/kb-doctor'` created `STATE_DIR/nested/`,
   which a non-recursive `readdirSync` + `*.json` filter **skips as a directory**. Operator-controlled
   input ⇒ not security. Matters because a typo makes a failing job invisible rather than erroring.
3. **Cited consumer is on the wrong branch, and NO consumer exists.** PR justifies the file-per-job
   design by *"`readdirSync` already used in five places in `dashboard/server.ts`"*. That file
   **404s on `nv-main` (this PR's base) and on `main`**; it is on `nv-dashboard` — 12,034 lines,
   **40** occurrences (not 5). `cron-failures`/`cron-run` grep to **zero** repo-wide incl.
   `nv-dashboard` ⇒ producer-only PR, markers written and nothing reads them. Also the two paths
   agree **only by coincidence of root**: marker `$REPO/data/shared/.cron-failures` ($REPO from the
   script's own location) vs dashboard `join(getDataDir(),'shared')` where
   `getDataDir()=NANOCLAW_DASHBOARD_DATA_DIR||join(getProjectRoot(),'data')` and
   `getProjectRoot()=NANOCLAW_BOARD_PROJECT_ROOT||resolve(import.meta.dirname,'..')`.

⭐⭐ **Finding 3 is the generalizable one: a PR's reuse/precedent citation can be TRUE on a sibling
branch and unverifiable from the base.** Checking the cited artifact on the **base branch** — not
just "does it exist somewhere" — is what turned a plausible-looking justification into a stated
caveat. Same family as [[feedback_mechanism_must_predict_observed_coordinates]]: audit the artifact
the decision rests on, at the coordinates the reader will look.

## 🔵 minor, verified

- Both bugs the header cites are **already fixed** on `nv-main`: current `funnel-cron.sh` captures
  `local rc=$?` on the next line and ends `[ "$FAILURES" -eq 0 ] || exit 1` *after* the `mv`, with a
  comment naming both traps. Past tense is accurate; a reader hunting live bugs won't find them.
- `data/` and `logs/` both gitignored ⇒ markers/log can never be accidentally committed.
- `scripts/**` is in `.github/nv-path-guard/nv-main.txt` ⇒ no path-guard blocker (contrast
  [[project_nanoclaw_1074_scheduled_task_dump]], where `config-examples/` was in no allowlist).
- Unverifiable from here, same as for the author: the live crontab on either box, and whether mail
  is delivered. The `kb-doctor`-scheduled-nowhere claim is therefore **unconfirmed on my side too** —
  I did not upgrade the author's caveat into a finding.
