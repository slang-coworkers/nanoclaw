---
name: slang-pr-review
license: MIT
type: workflow
description: "Run TWO independent Slang PR reviewers on the same target and merge their output. Reviewer A is the production-equivalent claude-code-action@v1 + .github/workflows/claude-pr-review.yml pipeline (six .claude/agents/* subagents driven by REVIEW.md). Reviewer B is Devin Review (app.devin.ai/review) via agent-browser. Devin requires a GitHub PR URL — for branch/patch input the workflow optionally opens a draft PR on szihs/slang to get a URL. Dry-run by default; --live-on-fork lets reviewer A post as nv-slang-bot[bot] but only against szihs/* repos."
requires: [code.read, issues.read]
uses:
  skills: [slang-pr-review, agent-browser, slang-code-reader, slang-github]
  workflows: []
---

# /slang-pr-review — Run two independent Slang PR reviewers in parallel

Use when asked to review a Slang PR / branch / patch. The workflow runs **two reviewers concurrently** and produces a combined report:

- **Reviewer A — nv-slang-bot.** The production claude-code-action@v1 + claude-pr-review.yml pipeline run locally. Six .claude/agents/* subagents, REVIEW.md protocol, deepwiki MCP. Owned by the `slang-pr-review` skill (scripts + prompt templates + byte-equivalence harness live there).
- **Reviewer B — Devin Review.** Triggered by browsing `https://app.devin.ai/review/<owner>/<repo>/pull/<n>` via the `agent-browser` skill. Requires a GitHub PR URL — see Step 0.5.

The two reviewers see the same diff and produce independent findings. They are complementary in practice (Devin tends to surface portability / silent-behavior issues; nv-slang-bot is stronger on subagent-domain correctness). Running both raises recall.

## Step 0: DETERMINE INPUT MODE {#input}

Pick exactly one based on what the requester sent:

| Mode | When | Source of "what to review" |
|---|---|---|
| `pr` | Requester gave a GitHub PR URL or `<owner>/<repo>#<n>` | PR diff via `gh pr diff` |
| `branch` | Requester gave a branch name (with optional repo) | Diff between branch and its base |
| `patch` | Requester attached a patch / diff / `.md` containing a unified diff | The attached file applied to a temp branch off `slang/master` |

If ambiguous, ask before proceeding. Wrong mode wastes ~25 min and ~$20.

## Step 0.5: ENSURE PR URL FOR DEVIN {#ensure-pr}

**Devin requires a GitHub PR URL.** Reviewer B can only run if a PR exists. Resolve based on mode:

- **`pr` mode** — PR URL is `https://github.com/<owner>/<repo>/pull/<n>`. Done.
- **`branch` mode** — if the branch is already attached to an open PR (`gh pr list --head <branch> --repo <repo>`), reuse that URL. Otherwise, with requester consent, push the branch to `szihs/slang` (if not there) and open a **draft PR** on szihs/slang with title prefixed `[devin-review-only]`. Capture URL. Mark for cleanup in Step 5.
- **`patch` mode` — apply the patch to a fresh temp branch on `szihs/slang`, push, open a draft PR with the same prefix. Mark for cleanup.

If the requester declines the draft-PR step OR token doesn't have szihs `pull_requests: write` (for branch/patch modes), set `DEVIN_URL=""` and proceed with Reviewer A only. The workflow MUST still complete — Devin is best-effort.

The slang-pr-review skill exposes a helper for this; the workflow's job is to decide whether to call it.

## Step 1: PREFLIGHT {#preflight}

Both reviewers need their tooling ready:

- **Reviewer A:** invoke the slang-pr-review skill's installer (idempotent). Ensures `~/.local/bin/claude` (>=2.1.x), `~/.local/bin/mcp-server-github`, and `/workspace/agent/slang` checkout (depth-50 master).
- **Reviewer B:** verify the `agent-browser` skill is available (`agent-browser --help`). It comes pre-installed in the container's base skill set.

If `--live-on-fork` is requested for Reviewer A, also verify `gh auth status` resolves to a token with `pull_requests: write` on the target szihs repo.

## Step 2: DISPATCH BOTH REVIEWERS IN PARALLEL {#dispatch}

Run A and B concurrently. Total wall time = max(A, B) ≈ 25 min instead of the ~40 min of sequential runs.

### Step 2a — Reviewer A (nv-slang-bot)

Invoke the slang-pr-review skill's `compose-and-run` entry point in the **background**. Same call shape as before:

```
slang-pr-review compose-and-run \
  --mode {pr|branch|patch} \
  --pr <N> | --branch <ref> | --patch <path> \
  --repo <owner/repo>    [for pr/branch] \
  [--live-on-fork] [--max-budget-usd 30]
```

Use `Agent(run_in_background=true)` or `Bash(run_in_background=true)`. Capture the run-directory path; do NOT poll. Expected wall time ~20–30 min.

### Step 2b — Reviewer B (Devin)

Only if `DEVIN_URL` is non-empty (per Step 0.5).

```bash
agent-browser open "https://app.devin.ai/review/<owner>/<repo>/pull/<N>"
```

Devin starts generating the review automatically on page load. Poll for completion (3–15 min):

```bash
# Wait for the Info-tab heading to flip from "PR analysis in progress..." to "Analysis complete"
agent-browser eval 'document.body.innerText.includes("Analysis complete") && !document.body.innerText.includes("PR analysis in progress")'
```

Use a poll loop with 45-second intervals; abort after 20 min cap.

When complete, click the "9 Flags" / "N Flags" badge (`agent-browser find text "Flags" click`) to expand the flag list. Extract:
- **Flag titles + severity tags** (`Bug` / `Info` / `Investigate`) + file:line
- **Devin's AI analysis** (multi-paragraph narrative at the top of the page)

Capture screenshots of:
- the analysis-complete state (`agent-browser screenshot`)
- the expanded flags region

Save extracted text to `<run_dir>/devin-flags.md` and screenshots alongside.

**Devin auth note:** `app.devin.ai/review` is publicly readable for public PRs without login. If the page shows a "Sign in" wall (private repo or rate limit), abort Reviewer B with a clear note in the report.

## Step 3: SUMMARIZE EACH REVIEWER {#summarize}

When both subprocesses complete (or when Reviewer A completes if Reviewer B was skipped):

- **Reviewer A:** invoke the skill's `summarize` entry on the run-directory. Severity counts (Verdict-line authoritative), per-subagent token usage + tool-call count, total cost.
- **Reviewer B:** parse `devin-flags.md`. Count flags by tag (`Bug` / `Info` / `Investigate`). Note any flag whose body refutes a prior reviewer's claim (e.g. "valid per LLVM conventions").

## Step 4: REPORT {#report}

Combined report. Channel depends on mode + live-on-fork:

- **`pr` mode + `--live-on-fork`** — Reviewer A's review is already posted on GitHub by `nv-slang-bot[bot]`. Send a single `mcp__nanoclaw__send_message` with: review URL, Reviewer A severity counts, Reviewer B (Devin) flag counts + Devin URL. Do NOT post Devin's findings to GitHub — they live on app.devin.ai.
- **`pr` mode (dry-run) / `branch` / `patch`** — Use `mcp__nanoclaw__send_file` to send Reviewer A's `final-review.md`. Use a separate `send_file` for `devin-flags.md` if Reviewer B ran. Plus a `send_message` summary that includes both reviewers' counts side-by-side and notes any disagreements.

**Side-by-side comparison row to include in the summary:**

| Reviewer | Severity counts | Wall | Cost |
|---|---|---|---|
| nv-slang-bot | 🔴 N / 🟡 N / 🔵 N | ~20–30 min | ~$15–25 |
| Devin Review | Bug N / Info N / Investigate N | ~3–15 min | (free; browser scrape) |
| Disagreements | <list> | — | — |

Never post Devin's flags to GitHub. Never post in `branch` or `patch` mode (no canonical PR target).

## Step 5: CLEANUP {#cleanup}

If Step 0.5 created a draft PR for the sole purpose of getting a Devin URL:

```bash
gh pr close <draft-pr-number> -R szihs/slang --delete-branch --comment "Closed automatically by slang-pr-review workflow — was opened only to obtain a Devin Review URL."
```

If Reviewer A's `--live-on-fork` posted a review on the same draft PR, **DO NOT close**. The review is part of the deliverable; the PR stays open until the requester closes it manually.

For `pr` mode, never close the requester's PR.

## Step 6: ITERATE (optional) {#iterate}

To A/B test a `REVIEW.md` or subagent prompt change:

1. Baseline: run once on the same input, capture severity counts from both reviewers.
2. Edit `/workspace/agent/slang/REVIEW.md` or the relevant `.claude/agents/*.md`.
3. Re-run, compare counts and `diff` the two `final-review.md` files plus the two `devin-flags.md` files.
4. **Revert** local edits before the next run — the skill reads them live. NEVER push these edits from the coworker; surface as a proposal PR to shader-slang/slang.

## Mode invariants

- **Read-only by default.** Posting requires `--live-on-fork` AND `--repo szihs/*`. The skill hard-guards both.
- **Patch mode is sandboxed.** The skill applies the patch to a temp branch, runs the review, then resets. No state leaks back to `slang/master`.
- **Devin is best-effort.** If the page fails to load, polling times out, or the page is auth-walled, Reviewer A still produces a valid report. Note Devin failure mode in the summary.
- **Cleanup is opportunistic.** Step 5 only fires for draft PRs we created. If the requester wants to keep the draft PR open (e.g. for additional human review), set `--keep-draft-pr` and skip cleanup.
- **Disagreement handling.** When the two reviewers contradict (e.g. one says 🔴 Bug, the other says "valid per spec"), surface BOTH claims in the summary and let the human adjudicate. Do NOT auto-resolve; the disagreement itself is signal.
- **Drift watch (Reviewer A).** The skill's `reference/validate.sh` compares the prompt + flags it generates against a vendored production run log; CI runs this on every PR to nanoclaw. Drift = action upstream changed; bump `claude-code-action.lock` per the skill's update procedure.
- **Devin doesn't expose a stable API.** The agent-browser scraping path is brittle by nature — UI changes will break the polling and extraction. Keep the selectors small (heading text + `Flags` button), and fail gracefully when the DOM shifts.
