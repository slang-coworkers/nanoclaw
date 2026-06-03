---
name: nanoclaw-pr-review
license: MIT
type: workflow
description: 'Run Devin Review on a slang-coworkers/nanoclaw PR via agent-browser. Read-only — returns devin-flags.md to the caller. Works on any open PR.'
requires: [code.read, issues.read]
uses:
  skills: [nanoclaw-pr-review-runner, agent-browser, nanoclaw-code-reader, nanoclaw-github]
  workflows: []
---

# /nanoclaw-pr-review — Run Devin Review on a NanoClaw PR

Review a PR in `slang-coworkers/nanoclaw`: drive `agent-browser` to Devin's review URL, poll, return findings via `send_file`. Read-only — never posts to GitHub. Scraper `devin-fetch.sh` lives in `nanoclaw-pr-review-runner` (local to `nv-nanoclaw`, not gh-skills-synced); accepts a GitHub PR URL or Devin URL.

## Steps

1. **Resolve target** {#resolve} — accept a PR number or GitHub PR URL; default repo `slang-coworkers/nanoclaw`. Verify the PR is OPEN; if CLOSED/merged, ask whether they want a historical review (Devin works on those too) or stop.

   ```bash
   PR_URL="https://github.com/slang-coworkers/nanoclaw/pull/<N>"
   gh pr view <N> -R slang-coworkers/nanoclaw --json number,title,state,baseRefName,headRefName,isDraft
   ```

2. **Recall** {#recall} — spawn an `Agent` subagent to scan prior learnings (keeps context clean); read a hit's file only if directly applicable.

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang-coworkers/nanoclaw PR review or recurring Devin flags. Read at most 3 learning files if directly applicable. Return ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Preflight** {#preflight} — confirm `agent-browser` is installed; failure = misconfigured container, report and stop.

   ```bash
   agent-browser --help >/dev/null
   ```

4. **Run Devin scraper** {#scrape} — invoke `devin-fetch.sh`. Exit codes: `0` success (`<RUN_DIR>/devin-flags.md` holds flags + narrative); `2` auth-wall (login redirect) — report status `auth-wall`, don't fail (App token likely lost access); `3` timeout — report `timeout`, don't fail (re-run usually succeeds); other non-zero — error, report and stop.

   ```bash
   RUN_DIR=$(mktemp -d /tmp/nanoclaw-pr-review-<N>.XXXXXX)
   nanoclaw-pr-review-runner devin-fetch \
     --url "$PR_URL" \
     --out "$RUN_DIR" \
     --poll-seconds 45 \
     --max-minutes 20
   ```

5. **Return findings** {#return} — send the artifact and summary to the parent. Verdict: `APPROVE` if zero bugs/gaps; `APPROVE_WITH_NITS` if only nits/questions; `REQUEST_CHANGES` if any bug; `SKIPPED` for auth-wall/timeout. Verdict is a recommendation — the operator decides whether to post on GitHub.

   ```
   mcp__nanoclaw__send_file(to="parent", path="<RUN_DIR>/devin-flags.md")
   mcp__nanoclaw__send_message(to="parent", in_reply_to=<id-of-review-request>, text="[Review Verdict] slang-coworkers/nanoclaw#<N>\n\n- **Verdict:** <APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES / SKIPPED>\n- **Devin status:** <success | auth-wall | timeout>\n- **Top flags:** <up to 3 flag titles, or 'no flags'>\n- **Severity:** <bug=N, gap=N, question=N> (or 'n/a' if skipped)\n- **Devin URL:** https://app.devin.ai/review/slang-coworkers/nanoclaw/pull/<N>")
   ```

## Constraints

- **Read-only.** Never call a GitHub-write tool: no `gh pr review`/`gh pr comment`/`gh pr merge`, no `mcp__*__github_create_*`/`mcp__*__github_post_*`. The operator gates posting.
- **No branch mutation.** Don't push, fetch into a working tree, or open a fork PR — scraping is browser-driven only.
- **One review per invocation** — don't loop or batch multiple PRs.

## Failure modes

- **Brittle scraper:** `devin-fetch.sh` selectors are minimal; UI changes → exit 1; report and ask the operator to file an issue against `nanoclaw-pr-review-runner`.
- **Auth-wall (exit 2):** repo is private; Devin must be installed on the org. Repeated exit 2 = App installation expired.
- **Timeout (exit 3) is not a failure:** large diffs (1000+ lines) may exceed 20 min; override with `--max-minutes 40` on request.
