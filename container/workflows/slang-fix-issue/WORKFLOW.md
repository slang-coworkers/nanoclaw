---
name: slang-fix-issue
license: MIT
type: workflow
description: 'Fix a triaged Slang issue: worktree, repro test, fix, verify, draft PR, peer review, report.'
extends: implement
requires: [code.edit, test.run]
uses:
  skills: [slang-build, slang-code-writer, slang-code-reader]
  workflows: []
---

# /slang-fix-issue — Fix a Triaged Slang Issue

> [!IMPORTANT]
> A triage handoff means _fix it_, not "ask how." Find root cause and resolve; propose the fix as a draft PR. The human reviews the artifact, not the plan.

**Draft PR mode.** Push your `fix/issue-<n>` branch to whichever remote the bot can write to — a fork, or `origin` directly when the bot has push rights on the upstream repo — and open a **draft PR** against `shader-slang/slang:master` (the repo's default branch is `master`, not `main`). You MAY NOT merge, mark ready-for-review, post on user-facing issues/PRs, or push to protected branches (`master`/release).

**Patch fallback.** Only when the push is genuinely *rejected* (no writable remote, branch protection, revoked token) → attach the `.patch` to the reviewer message; Reviewer A still runs, Reviewer B (Devin) is skipped (no PR to review).

## Steps

1. **Setup** {#setup} — Claim, worktree, repo in one pass.

   ```bash
   TARGET="slang-<number>"   # flat name, e.g. slang-10188
   SENTINEL="/workspace/agent/active-work/$TARGET"
   ```

   **If `$SENTINEL` exists with mtime <30 min** — another fixer owns it. Don't start parallel work:
   - **New context** → relay to parent and end: `send_message(text="Active session already on <target>. Relaying new context for consolidation.")`
   - **Duplicate handoff** → `send_message(text="Already working on <target> (started <mtime>). Subscribe to that session for updates.")`

   **Otherwise claim:**

   ```bash
   mkdir -p "$SENTINEL"
   date -u -Iseconds > "$SENTINEL/started-at"
   echo "<repo>#<number>: <title>" > "$SENTINEL/target"
   ```

   Ensure repo + a dedicated worktree per issue (isolates this session from other in-flight fixes):

   ```bash
   [ -d /workspace/agent/slang/.git ] || git clone --depth 50 https://github.com/shader-slang/slang.git /workspace/agent/slang
   cd /workspace/agent/slang && git fetch origin master && git checkout master && git pull
   git worktree add /workspace/agent/wt-{{target_slug}} -b fix/issue-<number>
   cd /workspace/agent/wt-{{target_slug}}
   ```

   **[MUST NOT] Worktree isolation.** Sibling fixers' `wt-<other-target>/` dirs share this filesystem; you can SEE them but **never read, write, mv, rm, or `git worktree remove`** them (cross-reads → wrong-source confusion; cross-deletes have killed active builds). On disk-full, **report `blocked` to parent** with `df -h /workspace` — never reclaim space from sibling dirs.
   - **YOU own (rw):** `wt-{{target_slug}}/`, `active-work/{{target_slug}}/`, `memory/fix-<number>.md`, `patches/fix-<number>.patch`.
   - **Shared (read-only):** `/workspace/agent/slang/` base clone — `git fetch` only.

2. **Recall** {#recall} — Subagent for prior fixes before researching:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang issue #<number>'s topic or similar fix patterns. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Understand** {#understand} — Read the triage handoff. Extract: issue number, symptom, relevant files, repro steps. If insufficient, fill in via DeepWiki + slang-mcp:

   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<question about the component>")
   mcp__slang-mcp__github_get_file_contents(owner="shader-slang", repo="slang", path="<relevant file>")
   ```

4. **Plan** {#plan} — Run `/slang-plan` with `target=slang-<issue_number>`. It writes a structured plan to `/workspace/agent/reports/slang-<issue_number>.md` (diagnosis, approach, files in scope, test strategy, risks). Subsequent steps assume it exists.

5. **Reproduce** {#repro} — Write a failing test at `tests/<area>/test-<issue_number>.slang` with the right directive:
   - CPU computation: `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type`
   - Interpreter: `//TEST:INTERPRET(filecheck=CHECK):`
   - Diagnostic: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`

   Confirm it fails:

   ```bash
   ./build/Debug/bin/slang-test tests/<area>/test-<issue_number>.slang
   ```

   If you can't reproduce, send `[Fix Report]` to parent with status `blocked: cannot reproduce` and stop. Don't guess the fix without a repro.

6. **Fix + verify** {#fix} — Use `/slang-code-writer`. Keep the change minimal, follow existing style, stay in one subsystem (parser / semantic checker / IR pass / emitter). Prefer IR pass fixes over emit-level workarounds; when fixing emitters, check sibling `slang-emit-*.cpp` for consistency.

   After each edit, rebuild and re-run:

   ```bash
   cmake --build --preset debug >/dev/null 2>&1 || cmake --build --preset debug
   ./build/Debug/bin/slang-test tests/<area>/test-<issue_number>.slang   # repro must PASS now
   ./build/Debug/bin/slang-test tests/<area>/                            # broader regression check
   ./extras/formatting.sh
   ```

   Build is 15-25 min; delegate it to an `Agent` subagent (`/slang-implement` Step 5 template): notify parent, then run the build inside the subagent which blocks until completion. No polling task.

   **[MUST] React to build failure on the same turn it surfaces.** When the build subagent (or `Monitor` tail) reports `BUILD_EXIT=<non-zero>`, build-failure stderr, ninja `FAILED:` lines, or "command failed", do NOT end the turn silently. Next turn:
   1. Read the tail: `tail -n 30 /workspace/agent/wt-{{target_slug}}/build/build.log`.
   2. If recoverable (compile error in your patch, missing dep, environment glitch): fix and re-run — counts as 1 of 2 allowed attempts.
   3. If unrecoverable OR both attempts used: commit current state with `wip:` prefix, **send `[Fix Report]` to parent with `Status: blocked`** + first 30 lines of the error tail + what was tried + worktree path. End the turn.

   Escalate every failure explicitly. The same blocked-Fix Report rule applies if verify fails after **2 independent fix attempts** (e.g. test fails but build succeeds).

6b. **Simplify** {#simplify} — Run `/code-review medium`, apply suggestions, re-verify, then proceed to Step 7.

7. **Push + draft PR** {#draft-pr} — Once verify is green:

   ```bash
   git add -A && git commit -m "Fix shader-slang/slang#<number>: <one-line title>"
   ```

   Resolve the push target via `git remote -v`: a remote the bot can write to — `origin` when the bot has upstream push rights, else a fork (one nominated via `--fork-repo <owner>/<repo>` in the inbound). Push the branch and open the draft PR with a heredoc body (single-line `--body` strips badly); use `--head fix/issue-<number>` for a same-repo push or `--head <fork-owner>:fix/issue-<number>` for a cross-fork push:

   ```bash
   git push <push-remote> fix/issue-<number>

   # PR_BODY heredoc with sections: ## Summary (bug + fix) / ## Diagnosis (root cause + file:line) /
   # ## Approach (subsystem, change, alternatives ruled out) / ## Files changed (bullets) /
   # ## Tests (Repro + Broader suite results) / ## Risk (blast radius + out-of-scope) / "Closes shader-slang/slang#<n>."
   PR_BODY=$(cat <<'MD'
   ## Summary
   ...
   MD
   )

   gh pr create \
     --repo shader-slang/slang \
     --base master --head <fix/issue-number-or-fork-owner:branch> --draft \
     --title "Fix #<number>: <one-line title>" \
     --body "$PR_BODY"
   ```

   Capture the PR URL — pass to Step 8.

   **Patch fallback** (only on a genuine push *rejection* — no writable remote / branch protection / revoked token): `git diff master HEAD > /workspace/agent/patches/fix-<issue_number>.patch`. Step 8 dispatches with `--mode patch <path>` instead of the PR URL.

   **7.5 PR follow-up is webhook-driven [MUST]** {#watcher} — Do **not** schedule a recurring poll. Once the draft PR is open, review comments, review verdicts, and CI results arrive as inbound `kind: webhook` messages (the GitHub webhook routes them back to this session via `pr_session_mappings`). On any such inbound whose `content.event` starts `github.pr_review`, `github.ci_failed`, or `github.pr_mention`, **run `/slang-github-webhook`** — it carries the per-event handling (reply on the thread, resolve LLM threads not human, infra-vs-code CI triage, the 2-round convergence guard). In brief:
   - `github.pr_review` / `github.pr_review_comment` / `REQUEST_CHANGES` → apply edits per Step 8's REQUEST_CHANGES path, re-run Step 6 verify, re-push. End the turn.
   - `github.ci_failed` → classify infra/flaky (`gh run rerun --failed`, ≤3×) vs real failure (reproduce → fix → re-push). End the turn.
   - `github.pr_review_thread` → update the PR's TODO comment; reopen the item if `unresolved`. End the turn.
   - PR `CLOSED`/`MERGED` → GC the worktree: `cd /workspace/agent/slang && git worktree remove --force /workspace/agent/wt-{{target_slug}}`; `rm -rf /workspace/agent/active-work/{{target_slug}}`; `send_message(to="parent", text="[Fix] slang#<number> PR <state>; worktree GC done.")`. End the turn.

   No PR URL / patch mode: nothing to watch — skip this step.

8. **Peer review** {#peer-review} — When `slang-reviewer` is in your destinations, dispatch with the artifact + test summary:

   ```
   send_message(to="slang-reviewer", text="[Fix Review Request] shader-slang/slang#<number>: <title>\n\nMode: pr (or patch)\nPR / Patch: <url-or-path>\nBase: shader-slang/slang@master\nTests added: tests/<area>/test-<issue_number>.slang\nTest results: <PASS / X failures>")
   ```

   End your turn after sending. Reviewer A's pipeline runs ~20-30 min; **don't reply to status echoes** — apply the quietness protocol from `### Reporting upstream`.

   On the reviewer's substantive reply:
   - APPROVE or 0 critical/high findings → Step 8.
   - REQUEST_CHANGES or critical/high findings → apply edits, re-run Step 5 verify, re-push (or regenerate patch), re-send. **Max 2 review rounds** — then take the better diff, proceed to Step 8, note unresolved feedback in the report.

   If `slang-reviewer` isn't in destinations, skip to Step 8.

9. **Report + save + refresh PR description** {#report} — Send the [Fix Report] to parent, refresh the PR body with final state, persist a memory file.

   The five-bullet report uses **markdown list syntax with bold field labels** (`•` glyphs degrade to raw bytes in dashboards):

   ```
   send_message(to="parent", in_reply_to=<id-of-triage-handoff>, text="[Fix Report] <repo>#<number>: <title>\n\n- **Status:** <fixed / partial / blocked>\n- **Changes:** <N files, +X / −Y> — <what changed>\n- **Tests:** <repro PASS/FAIL>; broader suite <result>\n- **Review:** <APPROVE / REQUEST_CHANGES / N findings — top concern>\n- **Next:** <draft PR <url> / patch attached / human action needed>")
   ```

   `in_reply_to` names the inbound that dispatched this fix (the triage handoff) so the report routes back up the exact edge — it is **required** on `[Fix Report]` under the chain-routing-gate (`thread_id` is derived from it).

   Refresh the draft PR body with final values — rebuild `$FINAL_BODY` from the Step 7 heredoc sections (Risk → renamed Review; `## Files changed` from `$(git diff --stat main..HEAD | sed 's/^/- /')`), then `gh pr edit <pr-number> -R shader-slang/slang --body "$FINAL_BODY"`.

   Persist the run to `/workspace/agent/memory/fix-<number>.md`: title, date, status, worktree path, branch, files changed, test result, PR/patch URL.

   Leave the active-work sentinel in place — stale sentinels (>30 min) are ignored by the next claimer.

## Sequential processing

Multiple issues queued: process ONE at a time (Steps 1-8 fully before the next). Max 2 parallel MCP calls. Between issues: `send_message(text="Fixing <N>/<total>: #<number>...")`.
