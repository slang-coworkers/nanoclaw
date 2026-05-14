---
name: slang-pr-review
license: MIT
type: workflow
description: "Run TWO independent Slang PR reviewers on the same target and merge their output. Reviewer A is the production-equivalent claude-code-action@v1 + .github/workflows/claude-pr-review.yml pipeline (six .claude/agents/* subagents driven by REVIEW.md). Reviewer B is Devin Review (app.devin.ai/review) via agent-browser, requires a PR URL. Both reviewers are read-only — output is returned to the caller as a markdown file via send_file; no GitHub posting. For branch input the workflow may open a draft PR on a nominated fork to give Devin a URL (best-effort, skipped without push rights). Patch mode applies locally and runs Reviewer A only."
requires: [code.read, issues.read]
uses:
  skills: [slang-pr-review-runner, agent-browser, slang-code-reader, slang-github]
  workflows: []
---

# /slang-pr-review — Run two independent Slang PR reviewers in parallel

Use when asked to review a Slang PR / branch / patch. The workflow runs **two reviewers concurrently** and produces a combined report:

- **Reviewer A — nv-slang-bot.** The production claude-code-action@v1 + claude-pr-review.yml pipeline run locally. Six .claude/agents/* subagents, REVIEW.md protocol, deepwiki MCP. Owned by the `slang-pr-review-runner` skill (scripts + prompt templates + byte-equivalence harness live there).
- **Reviewer B — Devin Review.** Triggered by browsing `https://app.devin.ai/review/<owner>/<repo>/pull/<n>` via the `agent-browser` skill. Requires a GitHub PR URL — see Step 2 below.

The two reviewers see the same diff and produce independent findings. They are complementary in practice (Devin tends to surface portability / silent-behavior issues; nv-slang-bot is stronger on subagent-domain correctness). Running both raises recall.

## Steps

1. **Determine input mode** {#input} — pick exactly one based on what the requester sent.

   | Mode | When | Source of "what to review" |
   |---|---|---|
   | `pr` | Requester gave a GitHub PR URL or `<owner>/<repo>#<n>` | PR diff via `gh pr diff` |
   | `branch` | Requester gave a branch name (with optional repo) | Diff between branch and its base |
   | `patch` | Requester attached a patch / diff / `.md` containing a unified diff | The attached file applied to a temp branch off `slang/master` |

   If ambiguous, ask before proceeding. Wrong mode wastes ~25 min and ~$20.

2. **Ensure PR URL for Devin** {#ensure-pr} — Devin requires a GitHub PR URL; Reviewer B can only run if a PR exists. Resolve based on mode:

   - **`pr` mode** — PR URL is `https://github.com/<owner>/<repo>/pull/<n>`. Done.
   - **`branch` mode** — if the branch is already attached to an open PR (`gh pr list --head <branch> --repo <repo>`), reuse that URL. Otherwise the workflow may open a **draft PR** on a fork where the bot has push rights, with title prefixed `[devin-review-only]`. The fork is determined at runtime — the requester nominates one (e.g. via `--devin-fork-repo <owner>/<repo>`), or the workflow infers from the existing remote of the working tree at `/workspace/agent/slang`. Mark for cleanup in Step 7.
   - **`patch` mode** — **never opens a PR**. The patch is applied locally to a temp branch in `/workspace/agent/slang` (Reviewer A's `repro.sh` does this in-process); Reviewer A reads the full diff against `origin/master` for context. Devin is skipped.

   If `branch` mode has no fork nominated, no working remote exists, OR the bot lacks `pull_requests: write` on the chosen fork, set `DEVIN_URL=""` and proceed with Reviewer A only. For `patch` mode `DEVIN_URL` is always empty — there's no PR to point Devin at. The workflow MUST still complete — Devin is best-effort.

   The slang-pr-review-runner skill exposes a helper for this; the workflow's job is to decide whether to call it.

3. **Preflight** {#preflight} — both reviewers need their tooling ready.

   - **Reviewer A:** invoke the slang-pr-review-runner skill's installer (idempotent). Ensures `~/.local/bin/claude` (>=2.1.x) and `/workspace/agent/slang` checkout (depth-50 master).
   - **Reviewer B:** verify the `agent-browser` skill is available (`agent-browser --help`). It comes pre-installed in the container's base skill set.

   For `pr` and `branch` modes, verify `gh auth status` resolves to a token that can read the target repo (read-only is sufficient — the skill never writes back). For `branch` mode where the workflow may open a Devin draft PR per Step 2, the token also needs `pull_requests: write` on the nominated fork.

4. **Dispatch both reviewers in parallel** {#dispatch} — run A and B concurrently. Total wall time = max(A, B) ≈ 25 min instead of the ~40 min of sequential runs.

   ### Reviewer A (nv-slang-bot)

   Invoke the slang-pr-review-runner skill's `compose-and-run` entry point in the **background**:

   ```
   slang-pr-review-runner compose-and-run \
     --mode {pr|branch|patch} \
     --pr <N> | --branch <ref> | --patch <path> \
     --repo <owner/repo>    [for pr/branch] \
     [--max-budget-usd 30]
   ```

   Use `Agent(run_in_background=true)` or `Bash(run_in_background=true)`. Capture the run-directory path; do NOT poll. Expected wall time ~20–30 min.

   ### Reviewer B (Devin)

   Skip if `DEVIN_URL` is empty (per Step 2). Otherwise call the skill:

   ```
   slang-pr-review-runner devin-fetch --url <DEVIN_URL> --out <run_dir>
   ```

   Best-effort: exit 2 = auth-wall, exit 3 = timeout, both treated as Reviewer-B-skipped. Reviewer A still completes.

5. **Summarize** {#summarize} — when both subprocesses complete (or just A if B was skipped), call the skill's summarizer for each run-directory. The skill returns severity counts, per-subagent cost, and a drift signal (GitHub-write attempts must be 0 — non-zero means the read-only allowlist leaked).

   **Quietness rule while Reviewer A runs.** Reviewer A's claude pipeline is dispatched in the background in Step 4 and runs ~20–30 min. While that's in flight, your only obligation is to wait. If an inbound arrives during that window:

   - **Substantive — RESPOND:** the requester sends a new patch (e.g. a clang-format-only update); the requester asks you to restart on a different patch or to abort; the requester reports an error or blocker; new instructions arrive that change the review scope; Reviewer A's subprocess emits a completion signal you can act on.
   - **No-op — END YOUR TURN SILENTLY (do not reply):** status echo from the requester ("waiting", "standing by"); polite ack from your parent ("got it", "👍"); generic "still waiting" messages; any inbound that contains no new patch, no decision, no error, no new instruction.

   Acknowledgments add no information; the peer already knows your state from your last outbound. Replying to a status-only inbound just wakes the peer, who acks back, who wakes you again — wasting tokens until Reviewer A breaks the cycle. End the turn silently and the loop dies on its own.

6. **Report** {#report} — output goes to the caller (your parent — typically slang-fixer). Never to GitHub.

   - `mcp__nanoclaw__send_file(to="parent")` — Reviewer A's `final-review.md`
   - `mcp__nanoclaw__send_file(to="parent")` — Reviewer B's `devin-flags.md` (if Reviewer B ran)
   - `mcp__nanoclaw__send_message(to="parent")` — **5-bullet executive summary** so your parent can make a decision and forward up the chain without re-reading the full review:

   ```
   send_message(to="parent", text="[Review Verdict] <repo>#<number> (<mode>)\n\n• Verdict: <APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES>\n• Findings: <X bugs, Y gaps, Z questions> (Reviewer A: <counts>; Reviewer B: <counts or skipped>)\n• Top concern: <one-line of the highest-severity finding, or 'no bugs'>\n• Test gaps: <one-line of recommended tests, or 'none'>\n• Artifacts: final-review.md attached; devin-flags.md attached (if B ran)")
   ```

   Five bullets, no more. Disagreements between A and B (e.g. one flags a bug the other says is correct-per-spec) belong in the attached `final-review.md` for the human to read; the executive bullet just notes "<N> A/B disagreements — see final-review.md".

7. **Cleanup** {#cleanup} — if Step 2 created a draft PR for the sole purpose of getting a Devin URL:

   ```bash
   gh pr close <draft-pr-number> -R <fork-repo> --delete-branch --comment "Closed automatically by slang-pr-review workflow — was opened only to obtain a Devin Review URL."
   ```

   For `pr` mode, never close the requester's PR.

8. **Iterate (optional)** {#iterate} — to A/B test a `REVIEW.md` or subagent prompt change:

   1. Baseline: run once on the same input, capture severity counts from both reviewers.
   2. Edit `/workspace/agent/slang/REVIEW.md` or the relevant `.claude/agents/*.md`.
   3. Re-run, compare counts and `diff` the two `final-review.md` files plus the two `devin-flags.md` files.
   4. Revert local edits before the next run — the skill reads them live. NEVER push these edits from the coworker; surface as a proposal PR to shader-slang/slang.

## Mode invariants

- **Read-only.** The reviewer never writes to GitHub. All output flows back to the caller via `send_file` + `send_message`. `summarize.py` counts GitHub-write tool attempts as a drift safety check — non-zero indicates the read-only allowlist leaked.
- **Patch mode is sandboxed.** The skill applies the patch to a temp branch, runs the review, then resets. No state leaks back to `slang/master`.
- **Patch mode skips Devin.** No PR URL means no Devin run.
- **Devin is best-effort.** If the page fails to load, polling times out, or the page is auth-walled, Reviewer A still produces a valid report. Note Devin failure mode in the summary.
- **Cleanup is opportunistic.** Step 7 only fires for draft PRs we created. If the requester wants to keep the draft PR open (e.g. for additional human review), set `--keep-draft-pr` and skip cleanup.
- **Disagreement handling.** When the two reviewers contradict (e.g. one says 🔴 Bug, the other says "valid per spec"), surface BOTH claims in the summary and let the human adjudicate. Do NOT auto-resolve; the disagreement itself is signal.
- **Drift watch (Reviewer A).** The skill's `reference/validate.sh` compares the prompt + flags it generates against a vendored production run log; CI runs this on every PR to nanoclaw. Drift = action upstream changed; bump `claude-code-action.lock` per the skill's update procedure.
- **Devin doesn't expose a stable API.** The agent-browser scraping path is brittle by nature — UI changes will break the polling and extraction. Keep the selectors small (heading text + `Flags` button), and fail gracefully when the DOM shifts.
