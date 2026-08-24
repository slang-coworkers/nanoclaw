---
name: slang-pr-review
license: MIT
type: workflow
description: 'Run THREE independent Slang PR reviewers in parallel — Reviewer A (claude-code-action@v1 + claude-pr-review.yml correctness pipeline), Reviewer B (Devin Review via agent-browser), and Reviewer C (clarity pipeline from shader-slang/slang#11340) — and merge their output into ONE combined report sent whole to the fixer. Returns the merged review via send_file; if the dispatch carries <github-post-authorized /> (a human tagged @nv-slang-bot), also posts Reviewer A''s correctness review back as a COMMENT-state review with prior bot reviews minimized OUTDATED first.'
requires: [code.read, issues.read, repo.write]
uses:
  skills: [slang-pr-review-runner, slang-clarity-review-runner, agent-browser, slang-code-reader, slang-github]
  workflows: []
---

# /slang-pr-review — Run three independent Slang PR reviewers in parallel

Use when asked to review a Slang PR, branch, or patch. Runs **three reviewers concurrently** into one combined report. All see the same diff; complementary (Devin surfaces portability / silent-behavior issues, nv-slang-bot is stronger on subagent-domain correctness, clarity catches unclear/unverifiable code the other two pass over):

- **Reviewer A — nv-slang-bot (correctness).** claude-code-action@v1 + claude-pr-review.yml pipeline run locally (six `.claude/agents/*` subagents driven by REVIEW.md, deepwiki MCP). High bar: bugs/gaps/questions. Owned by `slang-pr-review-runner`.
- **Reviewer B — Devin Review.** Browse `https://app.devin.ai/review/<owner>/<repo>/pull/<n>` via `agent-browser`. Needs a GitHub PR URL.
- **Reviewer C — clarity.** The repo-local clarity pipeline from shader-slang/slang#11340 (`slang-review-clarity-workflow` and siblings) run locally. Lower bar than A and *deliberately separate* from REVIEW.md: a finding flags code that is unclear / internally inconsistent / insufficiently explained, not a proven bug. Owned by `slang-clarity-review-runner`. Runs in all three modes (no Devin/PR-URL dependency).

## Steps

1. **Determine input mode** {#input} — pick exactly one. If ambiguous, ask first.

   | Mode     | When                                   | Source of "what to review"                        |
   | -------- | -------------------------------------- | ------------------------------------------------- |
   | `pr`     | GitHub PR URL or `<owner>/<repo>#<n>`  | PR diff via `gh pr diff`                          |
   | `branch` | Branch name (optional repo)            | Diff between branch and its base                  |
   | `patch`  | Patch / diff / `.md` with unified diff | Patch applied to a temp branch off `slang/master` |

2. **Recall** {#recall} — Subagent for prior reviewer flags / patterns; wiki-first, raw fallback:

   ```
   Agent(prompt="Check if /workspace/shared/wiki/index.md exists. IF YES: read it with limit=100 (concepts section only — the file is large), identify concept pages relevant to slang PR review or recurring reviewer flags, read up to 2 concept pages and follow their links to cited learnings if needed. If no concept fits, Grep wiki/ for keywords. IF NO wiki/ dir: fall back to Grep /workspace/shared/learnings/ for keywords and reading at most 3 hits. Return ≤5 bullets — title, 1-line summary, file path. No hits → 'no prior hits'.")
   ```

3. **Setup** {#setup} — Resolve the Devin URL + verify both reviewers' tooling.

   **Devin URL:**
   - `pr` mode → `https://github.com/<owner>/<repo>/pull/<n>`.
   - `branch` mode → reuse open PR if any (`gh pr list --head <branch> --repo <repo>`); else _may_ open a **draft PR** on a fork with bot push rights, title prefixed `[devin-review-only]` (fork from `--devin-fork-repo <owner>/<repo>` or the existing remote at `/workspace/agent/slang`). Mark for cleanup in **Cleanup**.
   - `patch` mode → **never opens a PR**; Reviewer B skipped.

   If `branch` mode has no usable fork OR the bot lacks `pull_requests: write`, set `DEVIN_URL=""` and run Reviewer A only (skill exposes a helper).

   **Tooling preflight:**
   - Reviewer A: run `slang-pr-review-runner`'s installer (idempotent; ensures `~/.local/bin/claude` ≥2.1.x and `/workspace/agent/slang` depth-50 master).
   - Reviewer B: `agent-browser --help` (failure = container misconfigured).
   - Reviewer C: shares A's checkout + claude CLI (no separate install). Verify the clarity skills are present: `test -d /workspace/agent/slang/.claude/skills/slang-review-clarity-workflow`. Missing = checkout predates shader-slang/slang#11340; re-run A's installer to refresh, else skip Reviewer C.
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

   **Reviewer B** — skip if `DEVIN_URL=""`. Else (best-effort; exit 2 = auth-wall, exit 3 = timeout, exit 4 = browser-launch-failure (transient infra — the script already cleared the stale Chrome profile and retried once; retry later, do NOT call it a "deterministic environment failure"), any of 2/3/4 = Reviewer-B-skipped):

   ```
   slang-pr-review-runner devin-fetch --url <DEVIN_URL> --out <run_dir>
   ```

   **Reviewer C** (background, no polling), ~15–25 min — skip only if **Setup** found the clarity skills absent. Runs in all three modes:

   ```
   slang-clarity-review-runner run-clarity \
     --mode {pr|branch|patch} \
     --pr <N> | --branch <ref> | --patch <path> \
     --repo <owner/repo>    [for pr/branch] \
     [--max-budget-usd 30]
   ```

   Use `Agent(run_in_background=true)` or `Bash(run_in_background=true)`; capture `run_dir_C`. Produces `<run_dir_C>/clarity-review.md`. Never posts.

   **End your turn after dispatching.** Apply the quietness protocol from the spine's **Report shape** rules (`chain-reporting.md`, under Mechanics): substantive inbounds (new patch, abort, completion, error) → respond; status-only → end silently.

5. **Merge + report** {#report} — On all subprocesses finishing (or whichever ran), call `slang-pr-review-runner`'s summarizer on `run_dir_A`. It returns severity counts, per-subagent cost, and a drift signal (must be 0 — nonzero = a non-COMMENT bot review was submitted). Reviewer C must also be drift-free: confirm `<run_dir_C>/tool-uses.jsonl` contains no GitHub-write tool call (no `gh api … --method POST/PUT`).

   **Build one combined report — all three reviews WHOLE, verbatim** — so the fixer gets every finding in a single file, plus a machine-readable result block at the end so the **PR-approver can parse a verdict without re-reading prose**. Concatenate in order, each section the full file contents (or an explicit `_skipped: <reason>_` line if that reviewer didn't run), then append one ` ```json ` result block:

   ```bash
   COMBINED="<run_dir_A>/combined-review.md"
   {
     echo "# Combined PR Review — <repo>#<number> (<mode>)"
     echo
     echo "## Reviewer A — Correctness (nv-slang-bot)"
     echo
     cat "<run_dir_A>/final-review.md" 2>/dev/null || echo "_skipped_"
     echo
     echo "## Reviewer B — Devin Review"
     echo
     cat "<run_dir_B>/devin-flags.md" 2>/dev/null || echo "_skipped: no Devin URL / auth-wall / timeout / browser-launch (transient)_"
     echo
     echo "## Reviewer C — Clarity"
     echo
     cat "<run_dir_C>/clarity-review.md" 2>/dev/null || echo "_skipped: clarity skills absent in checkout_"
     echo
     echo "## Result (machine-readable)"
     echo
     echo '```json'
     echo "$RESULT_JSON"
     echo '```'
   } > "$COMBINED"
   ```

   `$RESULT_JSON` is a single object the PR-approver consumes (its `commit_match` clause + verdict parse key on it). Build it from the summarizer + the runner's diff-integrity marker — never hand-guess the fields:

   ```json
   {"verdict":"<APPROVE|APPROVE_WITH_NITS|REQUEST_CHANGES>","bugs":<N>,"gaps":<N>,"questions":<N>,"diff_hash":"<run_dir_A integrity marker: the reviewed diff/patch hash>","reviewers_complete":<true|false>}
   ```

   - `verdict` — the same verdict as the `[Review Verdict]` message below.
   - `bugs`/`gaps`/`questions` — Reviewer A's severity counts from the summarizer (🔴 bugs, 🟡 gaps, questions).
   - `diff_hash` — the diff-integrity marker the runner recorded for what it actually reviewed (`pr` mode: the head diff hash; `patch` mode: the patch hash).
   - `reviewers_complete` — `true` only if every dispatched reviewer finished and drift==0; `false` if any errored, timed out, or drift was nonzero.

   **Route the combined report by the request mode**, read from **the tasking message that started this review** (it arrived via `send_message` and is in your context — do not read any file). One live shape plus patch/branch:

   - **Fix-chain / mention (live `pr` mode)** — a fixer peer-review handoff or an `@nv-slang-bot` mention. Reply to parent AND forward to the fixer.
   - **patch / branch mode** — no live PR; reply to parent only.

   ```
   # always reply to the requester (parent).
   send_file(to="parent", path="<run_dir_A>/combined-review.md")
   send_message(to="parent", in_reply_to=<id-of-review-request>, text="[Review Verdict] <repo>#<number> (<mode>)\n\n• Verdict: <APPROVE / APPROVE_WITH_NITS / REQUEST_CHANGES>\n• Findings: <X bugs, Y gaps, Z questions> (A: <counts>; B: <counts or skipped>; C clarity: <counts or skipped>)\n• Top concern: <one-line of the highest-severity finding, or 'no bugs'>\n• Test gaps: <one-line of recommended tests, or 'none'>\n• Disagreements: <N A/B/C disagreements — see combined-review.md, or 'none'>\n• Sent to: <parent + fixer | parent only>")

   # live pr mode: fix loop.
   send_file(to="slang-fixer", path="<run_dir_A>/combined-review.md")
   ```

   Notes:
   - `combined-review.md` (with its embedded ` ```json ` result) is what the fixer and the parent receive — one artifact, everyone sees the same whole report.

6. **Post review back to GitHub (authorized only)** {#post-review-to-github} — only when **the tasking message that started this review** (in your context — do not read any file) carries the `<github-post-authorized />` marker (emitted by the orchestrator's `slang-github-webhook` skill when a human tagged `@nv-slang-bot`); else a no-op. That same message carries the `REPO=<owner>/<name>` and `PR=<number>` lines — read the two values from it. **Posts Reviewer A's correctness review only** (`<run_dir_A>/final-review.md`) — Reviewer C's clarity findings are advisory and delivered to the fixer/parent via the combined report, not auto-posted to the PR. (Clarity has a lower bar; auto-posting it as a bot review would be noisy. Revisit if a clarity post is explicitly wanted.)

   Substitute `<REPO>` and `<PR>` with the values you read from the tasking message, and run this only if that message contained `<github-post-authorized />`:

   ```bash
   SKILL_DIR=/path/to/slang-pr-review-runner   # resolve via skill registry
   [ -s "$run_dir_A/final-review.md" ] && \
     "$SKILL_DIR/scripts/post-back.sh" "<REPO>" "<PR>" "$run_dir_A/final-review.md"
   ```

   Report result to parent: exit 0 = posted; exit 3 = no `pull_requests:write` (fall back to `send_file`); any nonzero = failure (final-review.md already sent). `post-back.sh` = `cleanup.sh` (minimize prior bot reviews/comments, resolve threads) + `post-review.sh` (POST event=COMMENT, dismiss any non-COMMENT bot review). Inline per-line comments are optional (`<run_dir_A>/inline-comments.json`, same POST); default posts body only.

7. **Cleanup** {#cleanup} — If **Setup** created a draft PR solely for a Devin URL, close it (skip if `--keep-draft-pr`; never close the requester's PR in `pr` mode):

   ```bash
   gh pr close <draft-pr-number> -R <fork-repo> --delete-branch \
     --comment "Closed automatically by slang-pr-review workflow — was opened only to obtain a Devin Review URL."
   ```

## Mode invariants

- **Inner CLI produces, outer workflow posts.** Inner `claude` CLI always writes `final-review.md` and stops; posting is decided by **Post review back to GitHub**'s marker.
- **Bot reviews are always `event=COMMENT`** — never APPROVE / CHANGES_REQUESTED. `post-review.sh` hardcodes the state and dismisses any non-COMMENT bot review.
- **Cleanup targets `nv-slang-bot` only** — production `claude` / `github-actions` auto-reviews untouched; we coexist with `claude-pr-review.yml`.
- **Round-2 hygiene.** Re-running on a PR minimizes the prior bot review OUTDATED and resolves its threads BEFORE posting the new one.
- **403 = graceful degrade.** No `pull_requests:write` → exit 3, fall back to `send_file`. Affects `slang-coworkers/*`; `shader-slang/*` are write-capable.
- **Patch mode is sandboxed** — temp branch, reviewed, reset; no leak to `slang/master`. Skips Devin (no PR URL). Reviewer C still runs (sandboxes its own temp branch).
- **Reviewer C (clarity) runs in all modes** — wraps the checkout's `slang-review-clarity-workflow` (shader-slang/slang#11340). It NEVER posts: the wrapper forbids `slang-review-post-github` and any GitHub-write tool; output is `clarity-review.md` only. Clarity is advisory — folded into the combined report sent to the fixer, never auto-posted to the PR.
- **Name any ad-hoc git worktree `wt-<pr-or-issue-num>-<tag>`** under `/workspace/agent/` (e.g. `wt-11544-verify`, not `slang-11544-verify`). The supervisor's worktree GC (supervise-issues §8) reaps by this convention; freehand names still get caught by its name-agnostic backstop, but the `wt-` prefix keeps discovery uniform and unambiguous. Reviewer C's isolation worktree already follows this (`wt-clarity-*`).
- **Combined report is whole.** A + B + C are concatenated verbatim into `combined-review.md` and sent to the fixer un-summarized — the fixer sees every finding, not a digest. The `[Review Verdict]` message is the only summarized artifact.
- **Reviewer C drift watch.** C reads the `slang-review-*` skills live from the checkout. If shader-slang/slang renames/restructures them, C breaks at the read step — update `slang-clarity-review-runner`'s wrapper prompt to track the new skill names.
- **Devin is best-effort.** Page-load / timeout / auth-wall — Reviewer A still produces a valid report; note Devin's failure in the verdict. Keep agent-browser selectors small (heading text + `Flags` button), fail gracefully on DOM shifts. A Chrome-launch failure (exit 4) is **transient** — the script clears the stale `/tmp/agent-browser-*` profile and retries once before giving up; a surviving failure means retry later. Do NOT record it in the merge/verdict notes as a "deterministic environment failure" (Chrome launches fine here without dbus); it is an infra hiccup, and re-running the review usually succeeds.
- **Devin refresh = auto, login-gated manual.** The bot scrapes Devin anonymously, so it cannot use Devin's (login-only) manual re-run button. Devin auto-re-analyzes the PR head on every new commit; on a follow-up commit the done-check keeps polling until the new analysis settles (the commit-status popover reports up-to-date / out-of-date / behind). There is nothing to "click" to force a refresh anonymously.
- **Disagreement = signal.** When A and B contradict, surface BOTH; let the human adjudicate.
- **Drift watch (Reviewer A).** The skill's `reference/validate.sh` (CI runs per PR) compares generated prompt + flags against a vendored production run log. Drift = upstream action changed; bump `claude-code-action.lock`.

## Operator notes (A/B testing)

A/B test a `REVIEW.md`, `.claude/agents/*` (Reviewer A), or `.claude/skills/slang-review-*` (Reviewer C) prompt change without modifying upstream:

1. Baseline: run once, capture severity counts.
2. Edit `/workspace/agent/slang/REVIEW.md`, a `.claude/agents/*.md`, or a `.claude/skills/slang-review-*/SKILL.md`; re-run; compare counts and `diff` the `final-review.md` / `devin-flags.md` / `clarity-review.md`.
3. Revert local edits before the next runtime run (the skills read them live). NEVER push from this coworker; surface as a proposal PR to shader-slang/slang.
