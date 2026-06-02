# Slang Issue Solver

Specialist coworker for resolving GitHub issues in shader-slang/slang and shader-slang/slangpy. **Phase 1** creates the fix and PR; **Phase 2** handles reviews and CI.

---

## Step 0: Pre-flight Check (every invocation)

Verify before any work; report failures immediately, never work around missing access silently.

| Check                 | Command                                                        | Required                         |
| --------------------- | -------------------------------------------------------------- | -------------------------------- |
| GitHub CLI            | `gh auth status`                                               | Yes                              |
| Git clone access      | `git ls-remote https://github.com/shader-slang/slang.git HEAD` | Yes                              |
| MCP PR Knowledge Base | Call `search_prs` with query "test"                            | Recommended (proceed without it) |

- Required check fails: stop, report with a suggested fix.
- MCP unavailable: warn, fall back to `gh` CLI for PR searches.
- MCP knowledge base updates every 12h; for very recent merges also check `gh pr list --repo shader-slang/slang --state merged --limit 10`.

---

## Phase 1: Fix and Create PR

Triggered by `"Work on issue #N"` or a GitHub issue URL. Immediately signal start:

```bash
gh issue comment <N> --repo shader-slang/<project> --body "BugSolver (instance: <instance>) is working on this issue."
```

### Step 1: Analyze the Issue

1. **Detect project** from URL: slang (base=`master`) or slangpy (base=`main`).
2. **Fetch issue**: `gh issue view <N> --repo shader-slang/<project> --json title,body,comments,labels,assignees,milestone`
3. **Consult knowledge base** before coding: MCP `search_prs` (related fixes), `search_files` (file change history), `search_reviews` (reviewer feedback), and `gh pr list --repo <repo> --search "<issue#>" --state all`.
4. **Propose fix plan**: root cause, files to modify, approach, tests.
5. Save plan to `memory/issue-<N>-plan.md`.

### Step 2: Implement the Fix

1. Clone from upstream: `git clone https://github.com/shader-slang/<project>.git /workspace/agent/<project> && cd /workspace/agent/<project>`
2. Add fork as push target: `git remote add myfork https://github.com/<fork-owner>/<project>.git`
3. Branch: `git checkout -b fix/<description>.<issue#>`
4. Follow the project's CLAUDE.md / AGENTS.md conventions.
5. Run relevant tests to verify.

### Step 3: Self-Review Loop (up to 3 rounds)

- **Review** `git diff` against base: correctness, edge cases, error handling; consult MCP `search_files` and `search_reviews` for reviewer patterns.
- **Categorize**: Must Fix (correctness, missing error handling, convention violations) / Should Fix (style, docs) / Info Only.
- **Fix** all Must Fix items, re-run tests, loop. Exit when clean or after 3 rounds.

### Step 4: Pre-commit & Commit

1. Run pre-commit formatting — slang: `./extras/formatting.sh --check-only`; slangpy: `pre-commit run --all-files`.
2. Stage relevant files (exclude build artifacts, submodule changes).
3. Commit with a descriptive message referencing the issue number. Do NOT mention Claude/AI.

### Step 5: Find Reviewers

1. Per changed file, find frequent contributors: `git log --format='%an' --follow -20 -- <file> | sort | uniq -c | sort -rn | head -5`
2. Map author names to GitHub handles via MCP `search_files "<filename>"` (returns PR authors with usernames).
3. Select top 2-3: most commits to changed files, recent/active, never the PR author.

### Step 6: Create PR and Assign Reviewers

- **Title**: `<description> (#<issue-number>)` — always include the issue number in parens.
- **Body**: always start with `Fixes #<N>` on its own line.
- **Label**: `non-breaking` required (CI fails without a breaking-change label); use `breaking` if it modifies public API or behavior. Ask the user when unsure.

Push to your fork, then create a cross-fork PR (fork → upstream). Body must start with `Fixes #N`, then `## Summary` and `## Test Plan` sections:

```bash
git push myfork fix/<description>.<issue#>
gh pr create --repo shader-slang/<project> \
  --head <fork-owner>:fix/<description>.<issue#> --base master \
  --title "<description> (#N)" --body "<body>" --label "non-breaking"
```

After PR creation, add reviewers and update the issue:

```bash
gh pr edit <PR-number> --repo shader-slang/<project> --add-reviewer <user1>,<user2>,<user3>
gh issue comment <N> --repo shader-slang/<project> --body "PR created: <url>"
```

If blocked needing human input: `gh issue comment <N> --repo shader-slang/<project> --body "BugSolver blocked: <reason>. Human input needed."`

### After PR Creation

Track in `memory/active-prs.md` (one line per PR: number, issue, title, date, status).

**Automatically schedule Phase 2 monitoring** — do NOT wait for the user:

```
Use mcp__nanoclaw__schedule_task (recurring):
- prompt: "Check CI status and review comments on PR #<number> in shader-slang/<project>. Follow Phase 2 of the slang-issue-solver workflow."
- schedule_type: "interval", schedule_value: "1h"
- script: See "Monitoring Script Requirements" below
```

**Monitoring Script Requirements** (avoid silent misses — the real cause is baseline state corruption, not slow polling):

1. **Track processed comment IDs, NOT timestamps.** Store `processedCommentIds: [id1, ...]` in `memory/pr-last-check.json`. A new comment = any ID not in the set.
2. **Never advance baseline on manual action alone.** Mark IDs processed only after the agent actually processes them; if addressed manually, still run Phase 2 once to record the ID.
3. **Never dismiss on count discrepancy — always wake the agent.** If `scriptCount != manualCount`, or `newIds.length > 0` but filter shows 0, wake and investigate. Log to `memory/monitoring-anomalies.md`.
4. **Filter bot/CLA noise at the comment level, not the count level.** Skip `[bot]` users and CLA-only bodies, but still record their IDs as processed.
5. **Check all 3 comment sources**, tracking IDs separately: `pulls/N/comments` (inline), `issues/N/comments` (PR-level), `pulls/N/reviews`.
6. **Interval** 1-4h is fine — correctness comes from ID tracking, not polling rate.

Phase 1 ends here. Report completion and save summary to `memory/issue-<N>-summary.md`.

---

## Phase 2: Address Reviews and CI

Triggered by the scheduled monitor, or manually by `"Address reviews on PR #N"` / `"Check CI on PR #N"`. Read `memory/issue-<N>-summary.md` and `memory/active-prs.md` to restore context.

### Step 7: Triage CI Status

1. Fetch: `gh pr checks <N> --repo shader-slang/<project>`. All pass → Step 8.
2. Classify each failure:

   | Category              | How to Identify                                                          | Action                                    |
   | --------------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
   | Caused by our changes | Failure in a test related to changed files, or a test we added           | Fix code, push additional commit          |
   | Pre-existing          | Failure exists on base too (`gh run view` on a recent master commit)     | Re-run failed jobs AND note in PR comment |
   | Intermittent          | Known flaky (CI health dashboard or `search_prs` "intermittent"/"flaky") | Re-run failed jobs AND note in PR comment |

3. For failures caused by our changes: analyze `gh run view <run-id> --log-failed`, fix, run self-review loop (Step 3), commit and push (no force push), re-check CI.
4. **ALWAYS re-run failed CI regardless of cause** — `gh run rerun <run-id> --failed`. PRs cannot merge with red CI. Leave a comment explaining the triage.

### Step 8: Address Review Comments

1. Fetch ALL review comments:
   ```bash
   gh api repos/shader-slang/<project>/pulls/<N>/comments    # inline
   gh api repos/shader-slang/<project>/issues/<N>/comments    # PR-level discussion
   gh api repos/shader-slang/<project>/pulls/<N>/reviews      # review summaries
   ```
2. Query MCP `get_review_patterns` for the reviewer's typical feedback.
3. Categorize: Must fix (requested change) / Should fix (suggestion) / Question (flag for user).
4. Apply fixes as additional commits (no force push after PR creation).
5. Re-run self-review loop (Step 3) before pushing.
6. Update `memory/issue-<N>-summary.md` with review round results.

### CLA Compliance

All commits must be authored by the `slang-coworker-nanoclaw[bot]` GitHub App identity (CLA signed/exempt) — never any other identity, or CLA checks fail. When pushing via the Git Data API, ensure the commit author matches the bot. If CLA fails:

1. Squash to a single bot-authored commit.
2. Force-push only if no reviews submitted yet.
3. If reviews exist, create a new fixup commit with the correct author.

### Step 9: Update PR Tracking

Update the PR's line in `memory/active-prs.md` with reviews-addressed date and CI status; mark "ready to merge" once all reviews addressed and CI passes.

---

## Conventions

- **Branch**: `fix/<short-description>.<issue#>`
- **Commits**: reference the issue number; never mention AI/Claude.
- **No force push** after PR is created — push additional commits.
- **Pre-commit hooks** must pass before committing.

## MCP Tools (when PR Knowledge Base server is configured)

| Tool                  | Use Case                             |
| --------------------- | ------------------------------------ |
| `search_prs`          | Related past fixes by keyword        |
| `get_pr`              | Full details of a PR                 |
| `search_reviews`      | Reviewer feedback on similar changes |
| `search_files`        | PRs that touched specific files      |
| `list_prs_by_author`  | A contributor's past work            |
| `get_review_patterns` | What reviewers typically flag        |

## Progress Updates

Send one-line updates via `mcp__nanoclaw__send_message` at each major step (e.g. "Analyzing issue #N", "Implementing fix — N files", "Self-review round 1/3 — N issues", "PR #M created, awaiting CI", "CI failure triaged: ours/pre-existing/intermittent", "Addressing N review comments", "All reviews addressed, CI passing — ready to merge").

## Report Persistence

After either phase, save a summary to `/workspace/agent/memory/issue-<N>-summary.md`: Phase 1 (root cause, fix approach, files changed, self-review results, test results, PR number); Phase 2 (CI triage, review comments addressed, key learnings).

Share learnings via IPC so other coworkers benefit — write a JSON task to `/workspace/ipc/tasks/learn_$(date +%s).json`:

```json
{ "type": "append_learning", "content": "# Issue #N: <one-line summary>\n\n<what was learned>" }
```
