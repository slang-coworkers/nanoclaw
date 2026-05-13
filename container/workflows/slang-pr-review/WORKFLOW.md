---
name: slang-pr-review
license: MIT
type: workflow
description: "Run the production Slang PR-review bot (anthropics/claude-code-action@v1 + .github/workflows/claude-pr-review.yml in shader-slang/slang) against a PR locally. Dry-run by default; live-on-fork posts as nv-slang-bot[bot] but only against szihs/* repos. Bridges to the slang-pr-review skill, which owns prompt construction, byte-equivalence with production, and result parsing."
requires: [code.read, issues.read]
uses:
  skills: [slang-pr-review, slang-code-reader, slang-github]
  workflows: []
---

# /slang-pr-review — Run the Slang PR-review bot locally

Use when asked to run the Slang automated reviewer against a PR or a patch — for example, to dry-run a real PR before promoting, to A/B test changes to `REVIEW.md` or `.claude/agents/*.md` in shader-slang/slang, or to review a patch a teammate sent in chat.

The skill `slang-pr-review` owns the actual scripts; this workflow is the protocol you follow.

## Step 0: DETERMINE INPUT MODE {#input}

The reviewer can review one of three input types. Pick exactly one based on what the requester sent:

| Mode | When | Source of "what to review" |
|---|---|---|
| `pr` | Requester gave a GitHub PR URL or `<owner>/<repo>#<n>` | PR diff via `gh pr diff` |
| `branch` | Requester gave a branch name (with optional repo) | Diff between branch and its base via `git diff <base>..<branch>` |
| `patch` | Requester attached a patch / diff / `.md` containing a unified diff | The attached file applied to `slang/master` |

If the requester is ambiguous, **ask** before proceeding. Wrong mode = wasted budget.

```bash
# pr mode (most common)
/slang-pr-review --pr 11139 --repo shader-slang/slang

# branch mode (review a colleague's WIP)
/slang-pr-review --branch users/foo/feature --repo szihs/slang

# patch mode (review a posted diff)
/slang-pr-review --patch /tmp/incoming-patch.diff --base shader-slang/slang@main
```

## Step 1: PREFLIGHT {#preflight}

Invoke the skill's installer; it is idempotent and only reinstalls what's missing:

```bash
bash container/skills/slang-pr-review/scripts/install.sh
```

That ensures `~/.local/bin/claude` (>=2.1.x), `~/.local/bin/mcp-server-github`, and a checked-out shader-slang/slang at `/workspace/agent/slang` (depth-50, master). Verifies `gh auth status` resolves to a writable token if `--live-on-fork` is requested.

## Step 2: COMPOSE & RUN {#run}

Delegate to the skill's `compose-and-run.sh`. It handles the full byte-equivalent reproduction of the production prompt + flags:

```bash
bash container/skills/slang-pr-review/scripts/compose-and-run.sh \
  --mode {pr|branch|patch} \
  --pr <number>          | --branch <ref> | --patch <path> \
  --repo <owner/repo>    [for pr/branch]   \
  [--live-on-fork]       [posts as nv-slang-bot[bot] on szihs/* only] \
  [--max-budget-usd 30]
```

The script runs the same `claude` CLI invocation the GitHub Action runs in production, with the same `--system-prompt`, `--allowed-tools`, `--mcp-config`, `--setting-sources project`, and the same model. Live-on-fork mode adds the github MCP and pre-step cleanup (minimize prior bot reviews) per `.github/workflows/claude-pr-review.yml`. Dry-run mode strips the github write tools and adds a DRY-RUN trailer to the prompt so the model emits the review as markdown instead of posting.

Expect ~20–30 min wall time. Delegate to a subagent (`Agent` tool) or run in background; do NOT poll.

## Step 3: SUMMARIZE {#summarize}

When the run exits, parse the run directory:

```bash
python3 container/skills/slang-pr-review/scripts/summarize.py <run_dir>
```

Reports:
- Severity counts (🔴 Bug / 🟡 Gap / 🔵 Question) — authoritative count is the Verdict line in `final-review.md` or `posted-review.json`
- Per-subagent token usage and tool-call count (cost attribution)
- Total session cost and budget utilization
- Drift markers (any unexpected tool error, post-attempts in dry-run, etc.)

## Step 4: REPORT {#report}

Output channel depends on input mode:

- **`pr` + `--live-on-fork`** → review is already posted on the szihs fork PR by `nv-slang-bot[bot]` via the github MCP. Reply to the requester with: review URL + severity counts + total cost.
- **`pr` (dry-run) / `branch` / `patch`** → no GitHub posting (those modes have no canonical PR to post against). Use `mcp__nanoclaw__send_file` to send `final-review.md` to the requester, plus a short `mcp__nanoclaw__send_message` summary with severity counts.

Never post to a non-szihs repo. Never post in `branch` or `patch` mode (no canonical PR to post on).

## Step 5: ITERATE (optional) {#iterate}

To A/B-test a `REVIEW.md` or subagent prompt change without modifying production:

1. Baseline: run once on the same input, capture severity counts from the Verdict line.
2. Edit `/workspace/agent/slang/REVIEW.md` or the relevant `.claude/agents/*.md`.
3. Re-run, compare counts and `diff` the two `final-review.md` files.
4. **Revert** local edits before the next run — the skill reads them live. NEVER push these edits from the coworker; surface as a proposal PR.

## Mode invariants

- **Read-only by default.** Posting requires `--live-on-fork` AND `--repo szihs/*`. The skill hard-guards both.
- **Patch mode is sandboxed.** The skill applies the patch to a temp branch, runs the review, then resets. No state leaks back to `slang/master`.
- **Token requirements.** `--live-on-fork` needs `GH_TOKEN` to resolve `nv-slang-bot[bot]` with `pull_requests: write` on the target szihs repo. Skill fails fast with a clear error if missing.
- **Drift watch.** The skill's `reference/validate.sh` compares the prompt + flags it generates against a vendored production run log; CI runs this on every PR to nanoclaw. Drift = action upstream changed; bump `claude-code-action.lock` per the skill's update procedure.
