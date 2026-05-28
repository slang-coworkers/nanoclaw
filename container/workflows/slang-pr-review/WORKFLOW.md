---
name: slang-pr-review
license: MIT
type: workflow
description: "Run TWO independent Slang PR reviewers in parallel — Reviewer A (production claude-code-action@v1 + claude-pr-review.yml pipeline) and Reviewer B (Devin Review via agent-browser) — and merge their output. The merged review is returned via send_file; if the orchestrator dispatch carries the <github-post-authorized /> marker (set when a human tagged @nv-slang-bot on the PR), the workflow ALSO posts the review back to GitHub as a COMMENT-state review with prior bot reviews minimized OUTDATED first — mirroring production's claude-pr-review.yml."
requires: [code.read, issues.read, repo.write]
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

5. **Summarize + report** {#report} — When both subprocesses complete (or just A if B was skipped), call the skill's summarizer for each run-directory. The skill returns severity counts, per-subagent cost, and a drift signal (must be 0 — non-zero means a non-COMMENT bot review was submitted, which violates the bot-reviews-are-COMMENT-only invariant).

   Always send output to parent via send_file:
   ```
   send_file(to="parent", path="<run_dir_A>/final-review.md")
   send_file(to="parent", path="<run_dir_B>/devin-flags.md")   # only if Reviewer B ran
   send_message(to="parent", text="[Review Verdict] <repo>#<number> (<mode>)\n\n• Verdict: <APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES>\n• Findings: <X bugs, Y gaps, Z questions> (A: <counts>; B: <counts or skipped>)\n• Top concern: <one-line of the highest-severity finding, or 'no bugs'>\n• Test gaps: <one-line of recommended tests, or 'none'>\n• Disagreements: <N A/B disagreements — see final-review.md, or 'none'>")
   ```

6. **Post review back to GitHub (authorized only)** {#post-review-to-github} — when the orchestrator's dispatch carries the `<github-post-authorized />` marker, invoke the skill's `post-back.sh` wrapper which runs cleanup + post-review in sequence. Without the marker, this step is a no-op (chat invocation, internal handoff, scheduled task — bot doesn't proactively post).

   The marker is emitted by the orchestrator's `slang-github-webhook` skill when the triggering comment contained `@nv-slang-bot` — a human's explicit invitation for the bot to reply. The dispatch text also carries `REPO=<owner>/<name>` and `PR=<number>` lines for grep.

   ```bash
   DISPATCH="$(cat /workspace/agent/.dispatch.txt 2>/dev/null || true)"
   if echo "$DISPATCH" | grep -q "<github-post-authorized />"; then
     REPO=$(echo "$DISPATCH" | grep -oE "^REPO=[^[:space:]]+" | head -1 | cut -d= -f2)
     PR=$(echo "$DISPATCH" | grep -oE "^PR=[0-9]+" | head -1 | cut -d= -f2)
     SKILL_DIR=/path/to/slang-pr-review-runner   # resolve via skill registry

     if [ -n "$REPO" ] && [ -n "$PR" ] && [ -s "$run_dir_A/final-review.md" ]; then
       if "$SKILL_DIR/scripts/post-back.sh" "$REPO" "$PR" "$run_dir_A/final-review.md"; then
         send_message(to="parent", text="✅ Review posted to $REPO#$PR (COMMENT-state, prior bot reviews minimized).")
       else
         RC=$?
         if [ "$RC" -eq 3 ]; then
           send_message(to="parent", text="⚠️ Review NOT posted to $REPO#$PR — token lacks pull_requests:write. final-review.md returned via send_file.")
         else
           send_message(to="parent", text="⚠️ Review NOT posted to $REPO#$PR (failure exit=$RC). final-review.md returned via send_file.")
         fi
       fi
     fi
   fi
   ```

   `post-back.sh` runs `cleanup.sh` (minimize prior bot reviews/comments, resolve threads) then `post-review.sh` (POST event=COMMENT, dismiss any non-COMMENT bot reviews as safety net). On 403 (token lacks `pull_requests:write` on the target repo), it exits 3 — the workflow falls back to `send_file` only.

   Inline comments (per-line) are an enhancement — the inner CLI can write them into a structured JSON file (`<run_dir_A>/inline-comments.json`) and `post-review.sh` will include them in the same POST. The default first-cut posts only the body; inline-comment generation is left to a future iteration of the inner CLI's prompt.

7. **Cleanup** {#cleanup} — If Step 3 created a draft PR solely to obtain a Devin URL, close it now:

   ```bash
   gh pr close <draft-pr-number> -R <fork-repo> --delete-branch \
     --comment "Closed automatically by slang-pr-review workflow — was opened only to obtain a Devin Review URL."
   ```

   For `pr` mode, never close the requester's PR. Skip if `--keep-draft-pr` was set.

## Mode invariants

- **Inner CLI produces, outer workflow posts.** The inner `claude` CLI in `repro.sh` always produces `final-review.md` and stops. Whether the merged review is posted back to GitHub is decided by Step 6 above based on the orchestrator's `<github-post-authorized />` marker.
- **Bot reviews are always `event=COMMENT`.** Never APPROVE / CHANGES_REQUESTED — bots shouldn't gate human merges. `post-review.sh` hardcodes the state and dismisses any non-COMMENT bot review as a safety net (mirrors production's "Dismiss unauthorized bot approvals" step in claude-pr-review.yml).
- **Cleanup targets `nv-slang-bot` only.** Production's `claude` / `github-actions` auto-reviews on `pull_request_target.synchronize` are deliberately left untouched. We coexist with `claude-pr-review.yml` on shader-slang/slang — both auto-reviews and webhook-triggered reviews land on the same PR, each cleaning up only its own prior runs.
- **Round-2 hygiene.** Re-running the review on the same PR (e.g. another `@nv-slang-bot review` after a force-push) minimizes the prior bot review as OUTDATED and resolves prior bot review threads BEFORE posting the new one — the human sees one current review, with old findings collapsed but available.
- **403 = graceful degrade.** If `pull_requests:write` is missing on the target repo, `post-review.sh` exits 3 and the workflow falls back to `send_file` only. Today this affects `slang-coworkers/*` (App lacks write); `shader-slang/*` repos (where reviews actually go) are write-capable.
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
