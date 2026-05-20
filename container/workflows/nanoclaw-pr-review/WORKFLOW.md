---
name: nanoclaw-pr-review
license: MIT
type: workflow
description: "Run Devin Review on a slang-coworkers/nanoclaw PR via agent-browser. Read-only — output is returned to the caller as devin-flags.md via send_file. No GitHub posting, no Reviewer-A pipeline. Devin works on any open PR regardless of base branch (nv-coworkers, nv-main, nv-dashboard, etc.)."
requires: [code.read, issues.read]
uses:
  skills: [nanoclaw-pr-review-runner, agent-browser, nanoclaw-code-reader, nanoclaw-github]
  workflows: []
---

# /nanoclaw-pr-review — Run Devin Review on a NanoClaw PR

Use when asked to review a PR in `slang-coworkers/nanoclaw`. Devin scrapes the diff, runs its analysis, and produces flags. The workflow drives `agent-browser` to Devin's review URL, polls for completion, and returns the findings via `send_file`. Read-only — never posts back to GitHub.

The Devin scraper (`devin-fetch.sh`) lives in the `nanoclaw-pr-review-runner` skill — local to `nv-nanoclaw`, not gh-skills-synced. It accepts either a GitHub PR URL or a Devin URL and rewrites GitHub URLs to the Devin form internally.

## Steps

1. **Resolve target** {#resolve} — accept input as a PR number (e.g. `349`) or a full GitHub PR URL. Default repo is `slang-coworkers/nanoclaw`.

   ```bash
   PR_URL="https://github.com/slang-coworkers/nanoclaw/pull/<N>"
   gh pr view <N> -R slang-coworkers/nanoclaw --json number,title,state,baseRefName,headRefName,isDraft
   ```

   Verify the PR exists and is OPEN before continuing. Devin handles any base branch (`nv-coworkers`, `nv-main`, `nv-dashboard`, `nv-slang`, etc.) — no special handling needed. If the PR is CLOSED or merged, ask the requester whether they want a historical review (Devin still works on closed PRs) or stop.

2. **Recall** {#recall} — Before running the scraper, spawn an `Agent` subagent to scan prior shared learnings for hits on this PR or similar review patterns. Keeps your context clean.

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang-coworkers/nanoclaw PR review or recurring Devin flags. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

   If a hit looks directly applicable, read just that file before continuing.

3. **Preflight** {#preflight} — confirm `agent-browser` is installed:

   ```bash
   agent-browser --help >/dev/null
   ```

   The `agent-browser` skill is part of the base container image — failure here means the container is misconfigured, not user error. Report and stop.

4. **Run Devin scraper** {#scrape} — invoke `devin-fetch.sh` from the `nanoclaw-pr-review-runner` skill:

   ```bash
   RUN_DIR=$(mktemp -d /tmp/nanoclaw-pr-review-<N>.XXXXXX)
   nanoclaw-pr-review-runner devin-fetch \
     --url "$PR_URL" \
     --out "$RUN_DIR" \
     --poll-seconds 45 \
     --max-minutes 20
   ```

   Treat exit codes as best-effort:

   - `0` — success. `<RUN_DIR>/devin-flags.md` exists with Devin's flags + narrative.
   - `2` — auth-wall. Devin's review page redirected to login. Report status as `auth-wall`; don't fail. Devin's GitHub-App token may have lost access — flag for the operator.
   - `3` — timeout. Devin took longer than `--max-minutes` to produce results. Report status as `timeout`; don't fail. Re-running later usually succeeds.
   - other non-zero — actual error. Report and stop.

5. **Return findings** {#return} — send the artifact and a 5-bullet summary back to the parent.

   ```
   mcp__nanoclaw__send_file(to="parent", path="<RUN_DIR>/devin-flags.md")
   mcp__nanoclaw__send_message(to="parent", text="[Review Verdict] slang-coworkers/nanoclaw#<N>\n\n• Verdict: <APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES / SKIPPED>\n• Devin status: <success | auth-wall | timeout>\n• Top flags: <up to 3 flag titles, or 'no flags'>\n• Severity: <bug=N, gap=N, question=N> (or 'n/a' if skipped)\n• Devin URL: https://app.devin.ai/review/slang-coworkers/nanoclaw/pull/<N>")
   ```

   Verdict mapping: `APPROVE` if zero bugs/gaps; `APPROVE_WITH_NITS` if only nits/questions; `REQUEST_CHANGES` if any bug; `SKIPPED` for auth-wall/timeout. The verdict is a recommendation — the operator decides whether to actually post a review on GitHub.

## Constraints

- **Read-only.** Never call any tool that writes to GitHub: no `gh pr review`, `gh pr comment`, `gh pr merge`, no `mcp__*__github_create_*`, no `mcp__*__github_post_*`. The workflow returns findings; the operator gates whether they get posted.
- **No mutation of the PR's branches.** Don't push, don't fetch into a working tree, don't open a fork PR. Devin scraping is purely browser-driven against Devin's hosted page.
- **One review per invocation.** Don't loop or batch-review multiple PRs in one call — the requester gives a single PR; running others is scope creep.

## Failure modes

- **Devin scraper is brittle.** `devin-fetch.sh` selectors are minimal (heading text + `Flags` button). If Devin changes their UI, the script falls through to exit code 1 — report and ask the operator to file an issue against `nanoclaw-pr-review-runner`.
- **Public PR vs private repo.** `slang-coworkers/nanoclaw` is private; Devin needs to be installed on the org and have access. If exit code 2 (auth-wall) repeats, the GitHub-App installation has likely expired.
- **Timeouts are not failures.** Long PRs (1000+ line diffs) sometimes blow past 20 min. The default is fine; override with `--max-minutes 40` for unusually large PRs at the operator's request.
