---
name: slang-pr-review
license: MIT
type: workflow
description: "Run TWO independent Slang PR reviewers in parallel — Reviewer A (production claude-code-action@v1 + claude-pr-review.yml pipeline) and Reviewer B (Devin Review via agent-browser) — and merge their output. Read-only; output flows back via send_file."
requires: [code.read, issues.read]
uses:
  skills: [slang-pr-review-runner, agent-browser, slang-code-reader, slang-github]
  workflows: []
---

# /slang-pr-review — Run two independent Slang PR reviewers in parallel

Use when asked to review a Slang PR, branch, or patch. The workflow runs **two reviewers concurrently** and produces a combined report:

- **Reviewer A — nv-slang-bot.** The production claude-code-action@v1 + claude-pr-review.yml pipeline run locally. Six `.claude/agents/*` subagents driven by REVIEW.md, deepwiki MCP. Owned by the `slang-pr-review-runner` skill (scripts + prompt templates + byte-equivalence harness live there).
- **Reviewer B — Devin Review.** Triggered by browsing `https://app.devin.ai/review/<owner>/<repo>/pull/<n>` via the `agent-browser` skill. Requires a GitHub PR URL.

The two reviewers see the same diff and produce independent findings. They are complementary — Devin tends to surface portability / silent-behavior issues; nv-slang-bot is stronger on subagent-domain correctness. Running both raises recall.

## Steps

1. **Determine input mode** {#input} — pick exactly one based on what the requester sent. Wrong mode wastes ~25 min and ~$20.

   | Mode | When | Source of "what to review" |
   |---|---|---|
   | `pr` | GitHub PR URL or `<owner>/<repo>#<n>` | PR diff via `gh pr diff` |
   | `branch` | Branch name (with optional repo) | Diff between branch and its base |
   | `patch` | Patch / diff / `.md` containing a unified diff | Patch applied to a temp branch off `slang/master` |

   If ambiguous, ask before proceeding.

2. **Recall** {#recall} — Subagent for prior reviewer flags / patterns:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang PR review or recurring reviewer flags. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Setup** {#setup} — Resolve the Devin URL + verify both reviewers' tooling.

   **Devin URL resolution:**
   - **`pr` mode** → URL is `https://github.com/<owner>/<repo>/pull/<n>`. Done.
   - **`branch` mode** → if the branch already has an open PR (`gh pr list --head <branch> --repo <repo>`), reuse that URL. Otherwise *may* open a **draft PR** on a fork where the bot has push rights, title prefixed `[devin-review-only]`. Fork is determined at runtime — requester nominates via `--devin-fork-repo <owner>/<repo>`, or infer from working tree's existing remote at `/workspace/agent/slang`. Mark for cleanup in Step 6.
   - **`patch` mode** → **never opens a PR.** Patch applied locally; Reviewer B is skipped.

   If `branch` mode has no usable fork OR the bot lacks `pull_requests: write`, set `DEVIN_URL=""` and proceed Reviewer A only. The slang-pr-review-runner skill exposes a helper for this.

   **Tooling preflight:**
   - Reviewer A: invoke `slang-pr-review-runner`'s installer (idempotent). Ensures `~/.local/bin/claude` (≥2.1.x) and `/workspace/agent/slang` (depth-50 master).
   - Reviewer B: `agent-browser --help` (pre-installed; failure = container misconfigured).
   - For `pr`/`branch`: `gh auth status` must resolve to a token that can read the target repo (read-only sufficient). For Devin draft-PR creation, also needs `pull_requests: write` on the nominated fork.

4. **Dispatch both reviewers in parallel** {#dispatch} — total wall time = max(A, B) ≈ 25 min instead of ~40 min sequential.

   **Reviewer A** (background, no polling):
   ```
   slang-pr-review-runner compose-and-run \
     --mode {pr|branch|patch} \
     --pr <N> | --branch <ref> | --patch <path> \
     --repo <owner/repo>    [for pr/branch] \
     [--max-budget-usd 30]
   ```
   Use `Agent(run_in_background=true)` or `Bash(run_in_background=true)`. Capture the run-directory path. Expected wall time ~20–30 min.

   **Reviewer B** — skip if `DEVIN_URL=""`. Otherwise:
   ```
   slang-pr-review-runner devin-fetch --url <DEVIN_URL> --out <run_dir>
   ```
   Best-effort: exit 2 = auth-wall, exit 3 = timeout — both treated as Reviewer-B-skipped. Reviewer A still completes.

   **End your turn after dispatching.** Reviewer A runs for 20–30 min; don't reply to status echoes during the wait. Apply the universal quietness protocol from `### Reporting upstream`. Substantive inbounds (new patch, abort, completion signal, error) → respond. Status-only inbounds → end the turn silently.

5. **Summarize + report** {#report} — When both subprocesses complete (or just A if B was skipped), call the skill's summarizer for each run-directory. The skill returns severity counts, per-subagent cost, and a drift signal (GitHub-write attempts MUST be 0 — non-zero means the read-only allowlist leaked).

   Send output to parent — never to GitHub:
   ```
   send_file(to="parent", path="<run_dir_A>/final-review.md")
   send_file(to="parent", path="<run_dir_B>/devin-flags.md")   # only if Reviewer B ran
   send_message(to="parent", text="[Review Verdict] <repo>#<number> (<mode>)\n\n• Verdict: <APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES>\n• Findings: <X bugs, Y gaps, Z questions> (A: <counts>; B: <counts or skipped>)\n• Top concern: <one-line of the highest-severity finding, or 'no bugs'>\n• Test gaps: <one-line of recommended tests, or 'none'>\n• Disagreements: <N A/B disagreements — see final-review.md, or 'none'>")
   ```

6. **Cleanup** {#cleanup} — If Step 3 created a draft PR solely to obtain a Devin URL, close it now:

   ```bash
   gh pr close <draft-pr-number> -R <fork-repo> --delete-branch \
     --comment "Closed automatically by slang-pr-review workflow — was opened only to obtain a Devin Review URL."
   ```

   For `pr` mode, never close the requester's PR. Skip if `--keep-draft-pr` was set.

## Mode invariants

- **Read-only.** Reviewer never writes to GitHub. All output via `send_file` + `send_message`. `summarize.py` counts GitHub-write tool attempts; non-zero = drift.
- **Patch mode is sandboxed.** Skill applies the patch to a temp branch, runs the review, then resets. No state leaks back to `slang/master`.
- **Patch mode skips Devin.** No PR URL → no Devin run.
- **Devin is best-effort.** Page-load failure / polling timeout / auth-wall — Reviewer A still produces a valid report. Note Devin's failure mode in the verdict.
- **Disagreement = signal.** When A and B contradict (e.g. one says 🔴 Bug, the other says "valid per spec"), surface BOTH in the verdict and let the human adjudicate. Don't auto-resolve.
- **Drift watch (Reviewer A).** The skill's `reference/validate.sh` compares the prompt + flags it generates against a vendored production run log; CI runs this on every PR. Drift = the upstream action changed; bump `claude-code-action.lock` per the skill's update procedure.
- **Devin's API is unstable.** agent-browser scraping is brittle. Keep selectors small (heading text + `Flags` button), fail gracefully when the DOM shifts.

## Operator notes (A/B testing)

To A/B test a `REVIEW.md` or subagent prompt change without modifying upstream:

1. Baseline: run once on the same input, capture severity counts.
2. Edit `/workspace/agent/slang/REVIEW.md` or the relevant `.claude/agents/*.md`.
3. Re-run; compare counts and `diff` the two `final-review.md` + `devin-flags.md` files.
4. Revert local edits before the next runtime run — the skill reads them live. NEVER push these from this coworker; surface as a proposal PR to shader-slang/slang.
