---
title: "Running slang PR reviewers when in-container gh is unauthenticated (OneCLI GitHub not connected)"
type: learning
topic: agent-ops
source: learnings/1789315995719-running-slang-pr-reviewers-when-in-container-gh-is.md
---

# Running slang PR reviewers when in-container gh is unauthenticated (OneCLI GitHub not connected)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789302418561-clc1ui
written_at: 2026-09-13T16:13:15.719Z
---

# Running slang PR reviewers when in-container gh is unauthenticated (OneCLI GitHub not connected)

## Symptom
`gh` fails in-container: `gh api …` returns `app_not_connected` ("GitHub is not connected in OneCLI"), and `GH_TOKEN` is a `ROUT…` gateway routing token, not a GitHub token. No fallback in `~/.config/gh/hosts.yml`. BUT: public-repo `git` read works (remote `https://x-access-token:placeholder@github.com/…`; anonymous public read), and the `mcp__slang-mcp__github_*` tools work via their own App. The `/slang-pr-review` runners hard-depend on `gh` in **pr mode** — so they break, but the diff is fully recoverable via git.

## Reviewer A (slang-pr-review-runner) — pre-staged pr mode via repro.sh directly
`compose-and-run.sh` pr mode calls `gh pr view` for HEAD/BASE SHA and `exit 1`s ("phantom PR") when gh fails — so you can't use it. Instead, replicate what production does (pre-stage the diff) using git and call `repro.sh` directly:
1. `git worktree add --detach wt-<pr>-revA origin/master` (isolate; `wt-` prefix ⇒ supervisor GC reaps it).
2. In it: `mkdir tmp`; `git diff origin/master...<head_sha> > tmp/pr-diff.patch` (3-dot = `gh pr diff` equivalent); `git diff --name-only … > tmp/pr-files.txt`; write `tmp/context.json = {repo,pr,base_sha,head_sha,diff_sha256}` with the REAL pr number.
3. `export MODE=pr REPO=<o/r> PR_NUMBER=<n> REPO_ROOT=<worktree> RUN_DIR=<writable dir> SKILL_DIR=/app/skills/slang-pr-review-runner HERE=$SKILL_DIR/scripts MAX_BUDGET_USD=… ; export PATH="$HOME/.local/bin:$PATH"; bash $HERE/repro.sh`.
REVIEW.md Step 1 makes the inner model **use `tmp/pr-diff.patch` as-is** when `context.json.pr` matches — so no `gh` is needed for the diff (gh is only tried for optional metadata, which fails harmlessly). Then apply compose-and-run's post-run guards manually: final-review.md ≥500 bytes, `grep -cE '"name": ?"(Task|Agent)"' tool-uses.jsonl` ≥1, no `API Error|socket|rate limit` in final-review.md, and `summarize.py <run_dir>` for severity counts + drift (non-COMMENT review submissions must be 0).

## Reviewer C (slang-clarity-review-runner) — two gotchas
1. **Read-only transcripts:** the copy at `/app/skills/slang-clarity-review-runner` can't `mkdir transcripts/` (read-only FS) → instant exit 0 with no output. Run the **`/home/node/.claude/skills/slang-clarity-review-runner`** copy instead (writable; sibling `slang-pr-review-runner/prompt-templates/mcp.dryrun.json` resolves there).
2. **gh-free mode:** use `--mode branch --branch <ref> --repo <o/r>` — it checks out the PR branch via git only (no gh). Its static prompt still says "read the diff via gh pr diff / local files reflect BASE," which is wrong for branch mode, but Opus recovers by reading the checked-out branch files directly. Verify drift: `tool-uses.jsonl` has no `--method POST/PUT` / `slang-review-post-github`.

## Reviewer B (Devin) is unaffected — `devin-fetch.sh --url <github PR url> --out <dir>` scrapes app.devin.ai anonymously.

## Also
Escalate the outage to the orchestrator (operator must reconnect GitHub in OneCLI at the `connect=github` URL the gateway returns) — any authorized GitHub **write** (post-back.sh) would fail until then. For an unauthorized review (no `<github-post-authorized />`), post-back is a no-op anyway, so the outage doesn't block delivery via send_file.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789315995719-running-slang-pr-reviewers-when-in-container-gh-is.md`_
