---
name: nanoclaw-pr-review-runner
license: MIT
description: "Drives Devin Review (app.devin.ai/review) via agent-browser against a GitHub PR. Read-only — outputs devin-flags.md. Used by the /nanoclaw-pr-review workflow. Local skill; no upstream sync."
allowed-tools: Bash(agent-browser:*) Bash(nanoclaw-pr-review-runner:*) Read Write Grep Glob
argument-hint: 'devin-fetch --url <github-pr-url-or-devin-url> --out <run-dir> [--poll-seconds 45] [--max-minutes 20]'
provides:
  - code.review
---

# NanoClaw PR Review Runner

Single-script skill: drives `agent-browser` to Devin Review's hosted page, polls until the analysis is finished, opens the findings lists, and extracts the narrative, the findings and the commit the analysis covers to a markdown file. Used by the `/nanoclaw-pr-review` workflow. Read-only — never posts back to GitHub.

## Pick a script

| Script | Used in workflow Step | What it does |
|---|---|---|
| `scripts/devin-fetch.sh` | Run Devin scraper | Drives `agent-browser` to load `app.devin.ai/review/<owner>/<repo>/pull/<n>`, polls until the analysis is finished, opens the closed Vulnerabilities/Bugs/Flags lists, extracts the narrative + findings to `devin-flags.md`, and reads the Commits tab into `devin-commit-status.txt`. Exits 2 on auth-wall, 3 on timeout — workflow treats both as best-effort skip. |

## Usage

```bash
bash /app/skills/nanoclaw-pr-review-runner/scripts/devin-fetch.sh \
  --url https://github.com/slang-coworkers/nanoclaw/pull/<N> \
  --out /tmp/run-XXXX \
  --poll-seconds 45 \
  --max-minutes 20
```

The URL accepts either a GitHub PR URL (rewritten internally to the Devin form) or a direct Devin review URL.

## Exit codes

| Code | Meaning | Workflow handling |
|---|---|---|
| `0` | Success — `<out>/devin-flags.md` produced | Send the file via `mcp__nanoclaw__send_file(to="parent")` |
| `2` | Auth-wall — Devin's page redirected to login | Best-effort skip; report status as `auth-wall`, recommend operator check Devin's GitHub-App installation |
| `3` | Timeout — Devin took longer than `--max-minutes` | Best-effort skip; report status as `timeout`, suggest re-run with longer `--max-minutes` |
| `1` (other) | Real error (DOM change, agent-browser broken, …) | Stop; report and ask operator to file an issue |

## Failure modes

- **Devin scrape is brittle.** Selectors are minimal: the analysis heading (both spellings), the count headers, "View results", "New analysis N" and the Commits tab. Devin UI changes will break extraction; the script fails gracefully and surfaces non-zero exit so the workflow can report. The same page logic lives in shader-slang/slang-skills `skills/slang-pr-review-runner/scripts/devin-fetch.sh`; fix both copies together, and run `node scripts/devin-fetch.test.mjs` after any change.
- **Only a settled checks rail counts as done.** `Checks 9/9` is a done signal; `Checks 12/22` is not, because CI can still be running while the findings sit behind "View results".
- **The page can show an earlier analysis.** After a push, Devin keeps the earlier analysis on screen and offers a "New analysis N" button; the script opens it. `devin-commit-status.txt` (also the first line of `devin-flags.md`) says whether the analysed commit is the PR head. When it says "behind", the findings describe an earlier commit.
- **Public vs private repos.** Devin needs the GitHub-App installed on the target org with read access. For `slang-coworkers/nanoclaw` (private), an auth-wall (exit 2) usually means the App installation has lapsed.
- **Long PRs blow past 20 min.** Override `--max-minutes 40` for unusually large diffs. Default is fine for typical PRs (<300 line diff).

## Why this skill is local (not gh-skills-fetched)

`slang-pr-review-runner` is fetched from `shader-slang/slang-skills` because the slang reviewer pipeline is a faithful reproduction of an upstream protocol that needs to track the upstream byte-for-byte. This skill is just a thin Devin scraper — there's no upstream byte-equivalence to track, so it lives directly on `nv-nanoclaw` and is owned by this repo.
