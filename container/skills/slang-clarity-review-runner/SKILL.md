---
name: slang-clarity-review-runner
license: MIT
description: "Reviewer C — clarity review. Reproduces shader-slang/slang's repo-local clarity-review pipeline (the seven .claude/skills/slang-review-* skills from shader-slang/slang#11340, entry point slang-review-clarity-workflow) locally against a PR, branch, or patch. Same checkout, same skills, same Opus model as Reviewer A's correctness pass — but the CLARITY pipeline, not REVIEW.md. Lower bar than correctness: a candidate flags code that is unclear/internally-inconsistent/insufficiently-explained, not a proven bug. Produces clarity-review.md and stops; it NEVER posts (slang-review-post-github is skipped — the wrapping /slang-pr-review workflow owns posting, COMMENT-state only). Local skill; no upstream sync. Used by the /slang-pr-review workflow as the third reviewer alongside Reviewer A (correctness) and Reviewer B (Devin)."
allowed-tools: Bash(slang-clarity-review-runner:*) Read Write Edit Grep Glob mcp__deepwiki__ask_question mcp__nanoclaw__send_message mcp__nanoclaw__send_file
argument-hint: 'run-clarity --mode pr|branch|patch [--pr N|--branch ref|--patch path] [--repo owner/name] [--max-budget-usd $]'
provides:
    - code.review.clarity
---
# Slang Clarity Review (Reviewer C)

Bridges the `/slang-pr-review` workflow's *what* (also clarity-review this PR) to the *how* (faithful reproduction of shader-slang/slang's clarity-review pipeline). Sibling to `slang-pr-review-runner` (Reviewer A); both wrap the same `slang/` checkout, but A wraps `REVIEW.md` (correctness) and C wraps `slang-review-clarity-workflow` (clarity). Scripts live alongside this file; the workflow owns the protocol.

## Pick a script

| Script | Used in workflow Step | What it does |
|---|---|---|
| `scripts/run-clarity.sh` | Reviewer C (#dispatch) | Top-level entry. Prepares the `slang/` checkout for the input mode, then invokes `claude --print` to apply the checkout's `.claude/skills/slang-review-clarity-workflow` pipeline (clarity → fine-grained → consolidate → scope-filter → resolve-judgment-calls). Captures the canonical candidate file as `clarity-review.md`. Never posts. |

Reviewer C reuses `slang-pr-review-runner`'s installer (claude CLI + `/workspace/agent/slang` checkout) and its dry-run MCP config (`prompt-templates/mcp.dryrun.json`, deepwiki only). The `/slang-pr-review` workflow runs that installer in preflight; this skill only adds the clarity wrapper on top.

## Modes

All three modes produce `clarity-review.md` (the canonical clarity candidates, verbatim). Whether anything is posted to GitHub is decided by the wrapping `/slang-pr-review` workflow — and by default it posts only **Reviewer A's** correctness review; clarity (C) is advisory feedback delivered to the requester/fixer.

- **`--mode pr`** — `gh pr diff <PR> -R <REPO>` is the source. Most common.
- **`--mode branch`** — `git diff <base>..<branch>`.
- **`--mode patch`** — a unified diff applied to a temp branch off `slang/master`; reviewed, then the temp branch is deleted (`slang/master` untouched).

## Equivalence with upstream — and the deliberate gaps

The inner CLI reads and applies the checkout's clarity skills **live** (`$REPO_ROOT/.claude/skills/slang-review-*`), so what the reviewer *sees and does* tracks shader-slang/slang exactly:

- ✅ Same seven clarity skills, same `slang-review-clarity-workflow` orchestration order
- ✅ Same Opus model and `slang/` checkout as Reviewer A
- ✅ Same `deepwiki` MCP server (reuses A's `mcp.dryrun.json`)

What the wrapper deliberately diverges on:

- ❌ **`gh` not `gh.exe`** — upstream's workflow assumes WSL/Windows-native `gh.exe`; we run Linux. The wrapper prompt instructs the model to use `gh`.
- ❌ **No posting** — upstream's step 11 runs `slang-review-post-github`. The wrapper forbids it (and any GitHub-write tool); it outputs the canonical candidate markdown and stops. Posting is owned by the `/slang-pr-review` workflow + `slang-pr-review-runner`'s `post-review.sh` (event=COMMENT only).
- ❌ **Not fed through REVIEW.md's bug filter** — clarity is intentionally separate from correctness (a clarity candidate need not prove a bug). The wrapper explicitly tells the model not to read `REVIEW.md`.

## Gotchas

- **Checkout must post-date shader-slang/slang#11340 (merged 2026-05-29).** `run-clarity.sh` hard-fails if `.claude/skills/slang-review-clarity-workflow/` is missing rather than silently degrading — re-run `slang-pr-review-runner`'s `install.sh` to refresh the checkout.
- **Reads only.** The tool allowlist permits `gh pr diff`/`gh pr view`/`gh api repos/*/pulls/*` for reads but no GitHub-write. `tool-uses.jsonl` is emitted so the workflow can assert no write was attempted.
- **Clarity is advisory.** Lower bar than correctness — expect more, softer findings. The `/slang-pr-review` workflow folds C into the combined report sent to the fixer, but does not auto-post C to GitHub.
- **Upstream drift.** If shader-slang/slang renames or restructures the `slang-review-*` skills, update this skill's wrapper prompt (`scripts/run-clarity.sh`) to track the new names. The skill reads them live from the checkout, so a rename breaks the pipeline at the read step.
- **A/B testing.** Edit the checkout's `.claude/skills/slang-review-*` locally to iterate; revert before the next runtime run. NEVER push from this coworker — surface as a proposal PR to shader-slang/slang.
