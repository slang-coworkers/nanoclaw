---
name: slang-pr-review
license: MIT
type: workflow
description: 'Run TWO independent Slang PR reviewers in parallel — Reviewer A (claude-code-action@v1 + claude-pr-review.yml pipeline) and Reviewer B (Devin Review via agent-browser) — and merge their output. Returns the merged review via send_file; if the dispatch carries <github-post-authorized /> (a human tagged @nv-slang-bot), also posts it back as a COMMENT-state review with prior bot reviews minimized OUTDATED first.'
requires: [code.read, issues.read, repo.write]
uses:
  skills: [slang-pr-review-runner, agent-browser, slang-code-reader, slang-github]
  workflows: []
---

# /slang-pr-review — Run two independent Slang PR reviewers in parallel

Use when asked to review a Slang PR, branch, or patch. Runs **two reviewers concurrently** into one combined report. Both see the same diff; complementary (Devin surfaces portability / silent-behavior issues, nv-slang-bot is stronger on subagent-domain correctness):

- **Reviewer A — nv-slang-bot.** claude-code-action@v1 + claude-pr-review.yml pipeline run locally (six `.claude/agents/*` subagents driven by REVIEW.md, deepwiki MCP). Owned by `slang-pr-review-runner`.
- **Reviewer B — Devin Review.** Browse `https://app.devin.ai/review/<owner>/<repo>/pull/<n>` via `agent-browser`. Needs a GitHub PR URL.

## Steps

1. **Determine input mode** {#input} — pick exactly one. If ambiguous, ask first.

   | Mode     | When                                   | Source of "what to review"                        |
   | -------- | -------------------------------------- | ------------------------------------------------- |
   | `pr`     | GitHub PR URL or `<owner>/<repo>#<n>`  | PR diff via `gh pr diff`                          |
   | `branch` | Branch name (optional repo)            | Diff between branch and its base                  |
   | `patch`  | Patch / diff / `.md` with unified diff | Patch applied to a temp branch off `slang/master` |

2. **Recall** {#recall} — Subagent for prior reviewer flags / patterns:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang PR review or recurring reviewer flags. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Setup** {#setup} — Resolve the Devin URL + verify both reviewers' tooling.

   **Devin URL:**
   - `pr` mode → `https://github.com/<owner>/<repo>/pull/<n>`.
   - `branch` mode → reuse open PR if any (`gh pr list --head <branch> --repo <repo>`); else _may_ open a **draft PR** on a fork with bot push rights, title prefixed `[devin-review-only]` (fork from `--devin-fork-repo <owner>/<repo>` or the existing remote at `/workspace/agent/slang`). Mark for cleanup in Step 6.
   - `patch` mode → **never opens a PR**; Reviewer B skipped.

   If `branch` mode has no usable fork OR the bot lacks `pull_requests: write`, set `DEVIN_URL=""` and run Reviewer A only (skill exposes a helper).

   **Tooling preflight:**
   - Reviewer A: run `slang-pr-review-runner`'s installer (idempotent; ensures `~/.local/bin/claude` ≥2.1.x and `/workspace/agent/slang` depth-50 master).
   - Reviewer B: `agent-browser --help` (failure = container misconfigured).
   - `pr`/`branch`: `gh auth status` must read the target repo (read-only OK). Devin draft-PR creation also needs `pull_requests: write` on the fork.

4. **Dispatch both reviewers in parallel** {#dispatch}

   **Reviewer A** (background, no polling), ~20–30 min:

   ```
   slang-pr-review-runner compose-and-run \
     --mode {pr|branch|patch} \
     --pr <N> | --branch <ref> | --patch <path> \
     --repo <owner/repo>    [for pr/branch] \
     [--max-budget-usd 30]
   ```

   Use `Agent(run_in_background=true)` or `Bash(run_in_background=true)`; capture the run-directory path.

   **Reviewer B** — skip if `DEVIN_URL=""`. Else (best-effort; exit 2 = auth-wall, exit 3 = timeout, both = Reviewer-B-skipped):

   ```
   slang-pr-review-runner devin-fetch --url <DEVIN_URL> --out <run_dir>
   ```

   **End your turn after dispatching.** Apply the quietness protocol from `### Reporting upstream`: substantive inbounds (new patch, abort, completion, error) → respond; status-only → end silently.

5. **Summarize + report** {#report} — On both subprocesses finishing (or just A), call the skill's summarizer per run-directory. It returns severity counts, per-subagent cost, and a drift signal (must be 0 — nonzero = a non-COMMENT bot review was submitted). Always send output to parent:

   ```
   send_file(to="parent", path="<run_dir_A>/final-review.md")
   send_file(to="parent", path="<run_dir_B>/devin-flags.md")   # only if Reviewer B ran
   send_message(to="parent", text="[Review Verdict] <repo>#<number> (<mode>)\n\n• Verdict: <APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES>\n• Findings: <X bugs, Y gaps, Z questions> (A: <counts>; B: <counts or skipped>)\n• Top concern: <one-line of the highest-severity finding, or 'no bugs'>\n• Test gaps: <one-line of recommended tests, or 'none'>\n• Disagreements: <N A/B disagreements — see final-review.md, or 'none'>")
   ```

6. **Post review back to GitHub (authorized only)** {#post-review-to-github} — only when the dispatch carries the `<github-post-authorized />` marker (emitted by the orchestrator's `slang-github-webhook` skill when a human tagged `@nv-slang-bot`); else a no-op. The dispatch also carries `REPO=<owner>/<name>` and `PR=<number>` lines for grep.

   ```bash
   DISPATCH="$(cat /workspace/agent/.dispatch.txt 2>/dev/null || true)"
   if echo "$DISPATCH" | grep -q "<github-post-authorized />"; then
     REPO=$(echo "$DISPATCH" | grep -oE "^REPO=[^[:space:]]+" | head -1 | cut -d= -f2)
     PR=$(echo "$DISPATCH" | grep -oE "^PR=[0-9]+" | head -1 | cut -d= -f2)
     SKILL_DIR=/path/to/slang-pr-review-runner   # resolve via skill registry
     [ -n "$REPO" ] && [ -n "$PR" ] && [ -s "$run_dir_A/final-review.md" ] && \
       "$SKILL_DIR/scripts/post-back.sh" "$REPO" "$PR" "$run_dir_A/final-review.md"
   fi
   ```

   Report result to parent: exit 0 = posted; exit 3 = no `pull_requests:write` (fall back to `send_file`); any nonzero = failure (final-review.md already sent). `post-back.sh` = `cleanup.sh` (minimize prior bot reviews/comments, resolve threads) + `post-review.sh` (POST event=COMMENT, dismiss any non-COMMENT bot review). Inline per-line comments are optional (`<run_dir_A>/inline-comments.json`, same POST); default posts body only.

7. **Cleanup** {#cleanup} — If Step 3 created a draft PR solely for a Devin URL, close it (skip if `--keep-draft-pr`; never close the requester's PR in `pr` mode):

   ```bash
   gh pr close <draft-pr-number> -R <fork-repo> --delete-branch \
     --comment "Closed automatically by slang-pr-review workflow — was opened only to obtain a Devin Review URL."
   ```

## Mode invariants

- **Inner CLI produces, outer workflow posts.** Inner `claude` CLI always writes `final-review.md` and stops; posting is decided by Step 6's marker.
- **Bot reviews are always `event=COMMENT`** — never APPROVE / CHANGES_REQUESTED. `post-review.sh` hardcodes the state and dismisses any non-COMMENT bot review.
- **Cleanup targets `nv-slang-bot` only** — production `claude` / `github-actions` auto-reviews untouched; we coexist with `claude-pr-review.yml`.
- **Round-2 hygiene.** Re-running on a PR minimizes the prior bot review OUTDATED and resolves its threads BEFORE posting the new one.
- **403 = graceful degrade.** No `pull_requests:write` → exit 3, fall back to `send_file`. Affects `slang-coworkers/*`; `shader-slang/*` are write-capable.
- **Patch mode is sandboxed** — temp branch, reviewed, reset; no leak to `slang/master`. Skips Devin (no PR URL).
- **Devin is best-effort.** Page-load / timeout / auth-wall — Reviewer A still produces a valid report; note Devin's failure in the verdict. Keep agent-browser selectors small (heading text + `Flags` button), fail gracefully on DOM shifts.
- **Disagreement = signal.** When A and B contradict, surface BOTH; let the human adjudicate.
- **Drift watch (Reviewer A).** The skill's `reference/validate.sh` (CI runs per PR) compares generated prompt + flags against a vendored production run log. Drift = upstream action changed; bump `claude-code-action.lock`.

## Operator notes (A/B testing)

A/B test a `REVIEW.md` or subagent prompt change without modifying upstream:

1. Baseline: run once, capture severity counts.
2. Edit `/workspace/agent/slang/REVIEW.md` or a `.claude/agents/*.md`; re-run; compare counts and `diff` the `final-review.md` + `devin-flags.md`.
3. Revert local edits before the next runtime run (the skill reads them live). NEVER push from this coworker; surface as a proposal PR to shader-slang/slang.
