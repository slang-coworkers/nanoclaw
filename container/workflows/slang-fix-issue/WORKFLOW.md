---
name: slang-fix-issue
license: MIT
type: workflow
description: 'Fix a triaged Slang issue: worktree, repro test, fix, verify, draft PR, peer review, report.'
requires: [code.edit, test.run]
uses:
  skills: [slang-build, slang-code-writer, slang-code-reader]
  workflows: []
---

# /slang-fix-issue — Fix a Triaged Slang Issue

> [!IMPORTANT]
> A triage handoff means _fix it_, not "ask how." The triager already wrote the solution brief; you reproduce, confirm the plan, fix, and propose the fix as a draft PR. The human reviews the artifact, not the plan.

**Draft PR mode.** Push your `fix/issue-<n>` branch to a remote the bot can write to — `origin` when it has upstream push rights, else the `slang-coworkers/slang` fork — and open a **draft PR** against `shader-slang/slang:master`. Hard limits: never merge, mark ready-for-review, or push to protected branches (`master`/release). Post on the issue/PR thread once verified at HEAD.

**Patch fallback.** Only when the push is genuinely *rejected* (no writable remote, branch protection, revoked token) → attach the `.patch` to the reviewer message; Reviewer A still runs, the second reviewer is skipped (no PR to review).

**PR-review-fix mode** (inbound carries `MODE=pr-review-fix`, `PR=<n>` — a human asked the bot to fix a reviewer's finding on a PR it didn't create). Same steps, three deltas:
- **In Setup:** `report_pr_created({repo, pr_number})` to claim it, then branch off the **PR head** (`git fetch origin pull/<n>/head`, worktree on `FETCH_HEAD`), not `master`.
- **In Push + draft PR:** deliver the fix as a **reviewable PR into the author's PR branch** (the slangbot model — never push commits onto their branch unsolicited). Two tiers:
   - **Slangbot-style cross-fork PR** (preferred): push the branch to the `slang-coworkers/slang` fork, then open a PR **into the author's PR branch** using the **`nv-slang-bot` user PAT** (a *user* token — the GitHub App cannot open a PR into a contributor fork; that returns `Resource not accessible by integration`). The author reviews and one-click merges:
     ```bash
     # Use the REST API, NOT `gh pr create` — the latter goes via GraphQL, which gets the
     # App token (403 cross-fork); REST `/repos/*/pulls` gets the user PAT that can open it.
     gh api -X POST repos/<author-owner>/slang/pulls \
       -f title="Fix for #<n>: <title>" -f head="slang-coworkers:fix/issue-<n>" \
       -f base="<author-head-ref>" -f body="$PR_BODY" --jq '.html_url'
     ```
     `report_pr_created` the new PR, and comment its link on the original PR. (Same-repo PR → push to `origin` and use `gh pr create --repo shader-slang/slang --base <author-head-ref> --head fix/issue-<n>` — REST is only for the cross-fork case.)
   - **Patch-comment fallback** (until the `nv-slang-bot` user PAT is provisioned, or if the PR open is rejected): post the diff + a `git apply` one-liner as a comment on the original PR. Do **not** push to the author's branch, and do **not** open a master-based carrier PR.
- Post back on the review thread once verified at HEAD.

**What to fix** is whatever the request names — CI failures, a reviewer's finding, or open bot review threads. Reuse `/slang-github-webhook`'s "CI failure" and "Review verdict / inline comment" handling rather than reinventing it. Unscoped ("help with this PR") → fix failing CI first, then sweep open bot review threads.

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

   **[MUST NOT] Worktree isolation.** Sibling fixers' `wt-<other-target>/` dirs share this filesystem; you can SEE them but **never read, write, mv, rm, or `git worktree remove`** them. On disk-full, **report `blocked` to parent** with `df -h /workspace/agent` (the worktree volume — a separate, larger disk than the always-healthy root mount) — never reclaim space from sibling dirs.
   - **YOU own (rw):** `wt-{{target_slug}}/`, `active-work/{{target_slug}}/`, `memory/fix-<number>.md`, `patches/fix-<number>.patch`.
   - **Shared (read-only):** `/workspace/agent/slang/` base clone — `git fetch` only.

2. **Recall** {#recall} — Recall prior fixes per the Workspace recall rule in your spine, keyed on slang issue #<number>'s topic and similar fix patterns.

3. **Understand** {#understand} — Read the triage handoff. Extract: issue number, symptom, relevant files, repro steps. Then read the maintainer's direction **at the source**: every maintainer comment and review on the issue and on each PR linked to it (`gh api repos/shader-slang/slang/issues/<n>/comments`, `…/pulls/<pr>/reviews`, `…/pulls/<pr>/comments`). The handoff and any parent relay are summaries, not the spec. If insufficient, fill in via DeepWiki + slang-mcp:

   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<question about the component>")
   mcp__slang-mcp__github_get_file_contents(owner="shader-slang", repo="slang", path="<relevant file>")
   ```

4. **Reproduce** {#repro} — Write a failing test at `tests/<area>/test-<issue_number>.slang` with the right directive:
   - CPU computation: `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type`
   - Interpreter: `//TEST:INTERPRET(filecheck=CHECK):`
   - Diagnostic: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`

   Confirm it fails, then commit the test on its own so the PR's first commit shows the failure the fix removes:

   ```bash
   ./build/Debug/bin/slang-test tests/<area>/test-<issue_number>.slang
   git add tests/<area>/test-<issue_number>.slang && git commit -m "tests: add failing repro for shader-slang/slang#<number>"
   ```

   If you can't reproduce, send `[Fix Report]` to parent with status `blocked: cannot reproduce` and stop. Don't guess the fix without a repro.

5. **Plan** {#plan} — The triager's solution brief (in the handoff and `memory/triage-<number>.md`) is the plan's starting point; the repro is its test. Confirm or correct the brief into a plan of at most 10 lines at `/workspace/agent/reports/slang-<issue_number>.md` (approach, files in scope, test strategy, risks); dispatched without a brief, write those lines from the issue yourself. Edits are refused until this file exists.

   The plan opens with `## Maintainer requirements (as of <newest maintainer comment URL>)`: one item per requirement, `R<n>. "<verbatim quote>" — <comment URL>`, each marked **planned**, **conflict — asked <link>** or **out of scope — maintainer agreed <link>**; or `none — <reason>`. Pass that section as `REQUIREMENTS:` on every codex critique round (a round without it is not recorded). When a maintainer comments again, refresh it and re-run PLAN_REVIEW before building on it; two conflicting maintainer constraints go back to them on GitHub before you build.

6. **Fix + verify** {#fix} — Use `/slang-code-writer`. Keep the change minimal, follow existing style, stay in one subsystem (parser / semantic checker / IR pass / emitter). Prefer IR pass fixes over emit-level workarounds; when fixing emitters, check sibling `slang-emit-*.cpp` for consistency.

   **One reviewable commit per logical change**, in the order a reviewer should read them: the failing test (step 4), the fix, then any rename/refactor or cleanup the fix needed, then formatting/docs. Each commit builds on its own; its message is `component: imperative summary` plus one paragraph of why. Never a single "fix everything" commit and never a behaviour change mixed with a rename. If the series got messy, `git reset --soft <base>` and re-commit in those slices with `git add <files>` per slice.

   After each edit, rebuild and re-run:

   ```bash
   cmake --build --preset debug >/dev/null 2>&1 || cmake --build --preset debug
   ./build/Debug/bin/slang-test tests/<area>/test-<issue_number>.slang   # repro must PASS now
   ./build/Debug/bin/slang-test tests/<area>/                            # broader regression check
   ./extras/formatting.sh
   ```

   Build is 15-25 min: notify parent (`send_message("⚙️ build — fix/issue-<number> — ETA 20 min")`), then run it inside an `Agent` subagent that blocks until completion; never a polling task or a scheduled task.

   **[MUST] React to build failure on the same turn it surfaces.** When the build subagent (or `Monitor` tail) reports `BUILD_EXIT=<non-zero>`, build-failure stderr, ninja `FAILED:` lines, or "command failed", do NOT end the turn silently. Next turn:
   1. Read the tail: `tail -n 30 /workspace/agent/wt-{{target_slug}}/build/build.log`.
   2. If recoverable (compile error in your patch, missing dep, environment glitch): fix and re-run — counts as 1 of 2 allowed attempts.
   3. If unrecoverable OR both attempts used: commit current state with `wip:` prefix, **send `[Fix Report]` to parent with `Status: blocked`** + first 30 lines of the error tail + what was tried + worktree path. End the turn.

   The same blocked `[Fix Report]` rule applies when verify fails after **2 independent fix attempts** (test fails, build succeeds).

   **Simplify before shipping.** Once verify is green, run `/code-review medium`, apply its suggestions, and re-verify (rebuild + re-run the repro and broader suite) so the change stays minimal before you push.

7. **Push + draft PR** {#draft-pr} — Once verify is green and `git log --oneline master..HEAD` reads test → fix → cleanup (step 6), push the branch and open the PR. Target depends on mode:
   - **Triaged-issue mode (default):** push to a writable remote (`origin`, else the `slang-coworkers/slang` fork) and open a **draft PR** against `--repo shader-slang/slang --base master`.
   - **PR-review-fix mode:** deliver into the author's PR per the deltas above (slangbot-style cross-fork PR via the `nv-slang-bot` user PAT, else patch-comment).

   Keep the description **concise**: a squash merge copies it into slang's git log as the commit message. Write it to a file and pass `--body-file` (single-line `--body` strips badly) with four labeled sections, **each at most 2 lines**: **Summary** (the bug and the fix), **Root cause** (`file:line`), **Tests** (repro + broader suite), **Risk** (blast radius), then `Fixes #<n>` / `Closes #<n>.` The whole description stays under 1,000 characters and has no tables; a hook refuses `gh pr create` / `gh pr edit` otherwise and names what is over. A question that blocks merge is one line: `Open question (blocks merge): <the question> — details in the explanation comment.` The approach, rejected alternatives, design rationale, per-case tables and long risk lists go in the explanation comment, not here; GitHub already lists the files. Capture the PR URL for the **Peer review** step.

   Once the PR is open, and after **every** later push, run `/explain-diff-html` so the PR's explanation comment (one marker-identified comment, edited in place; other bots usually comment first) explains the current head. While a push is unexplained the turn cannot end and `[Fix Review Request]` / `[Fix Report]` are refused.

   Apply the required `pr:` label and trigger CI (a draft PR does not auto-run `ci.yml`); re-dispatch after each push:

   ```bash
   gh pr edit <pr-number> -R shader-slang/slang --add-label "{{vars.labelNonBreaking}}"   # or "{{vars.labelBreaking}}" for ABI/language changes
   gh workflow run ci.yml -R shader-slang/slang --ref fix/issue-<number>
   ```

   **Patch fallback** (push rejected, or PR open not yet available): `git diff master HEAD > /workspace/agent/patches/fix-<issue_number>.patch`; the **Peer review** step dispatches the patch instead of a PR URL.

   **7.5 PR follow-up is webhook-driven [MUST]** {#watcher} — Do **not** schedule a recurring poll. Once the draft PR is open, review comments, review verdicts, and CI results arrive as inbound `kind: webhook` messages (the GitHub webhook routes them back to this session via `pr_session_mappings`). On any such inbound whose `content.event` starts `github.pr_review`, `github.ci_failed`, or `github.pr_mention`, **run `/slang-github-webhook`** — it carries the per-event handling (reply on the thread, resolve LLM threads not human, infra-vs-code CI triage, the 2-round convergence guard). In brief:

   **[MUST] Never gate a human-facing reply on a build.** When a maintainer asks a question or requests a rename/label, reply **on the same turn**, before any build/CI work. A one-liner is fine ("on it — re-stacking per your review; full reply once the build lands"). Don't batch the reply + rename + push into "one shot after the build" — a build that hangs then leaves the maintainer in silence while your queue drains and the session is reaped on `absolute-ceiling`. Answer first, build second.
   - `github.pr_review` / `github.pr_review_comment` / `REQUEST_CHANGES` → apply edits per the **Peer review** step's REQUEST_CHANGES path, re-run **Fix + verify**, re-push. End the turn.
   - `github.ci_failed` → classify **priority-yield** (only failed jobs are `wait-for-human-priority` + `check-ci`: do nothing — `retry-yielded-bot-ci` reruns it, aging force-runs it ≤~8h) vs infra/flaky (`gh run rerun --failed`, ≤3×) vs real failure (reproduce → fix → re-push). End the turn.
   - `github.pr_review_thread` → update the PR's TODO comment; reopen the item if `unresolved`. End the turn.
   - PR `CLOSED`/`MERGED` → clean up the worktree: `cd /workspace/agent/slang && git worktree remove --force /workspace/agent/wt-{{target_slug}}`; `rm -rf /workspace/agent/active-work/{{target_slug}}`; `send_message(to="parent", text="[Fix] slang#<number> PR <state>; worktree cleaned up.")`. End the turn.

   No PR URL / patch mode: nothing to watch — skip this step.

8. **Peer review** {#peer-review} — When `slang-reviewer` is in your destinations, dispatch with the artifact + test summary:

   ```
   send_message(to="slang-reviewer", text="[Fix Review Request] shader-slang/slang#<number>: <title>\n\nMode: pr (or patch)\nPR / Patch: <url-or-path>\nBase: shader-slang/slang@master\nTests added: tests/<area>/test-<issue_number>.slang\nTest results: <PASS / X failures>\nMaintainer direction: <comment URLs, or none>\nFixer self-check: <R1 met · R2 partial (why) · …>")
   ```

   Send the maintainer's comment links, not your paraphrase: the reviewer builds its own requirement list from them and checks it against your self-check. The critique gate refuses a request whose `Maintainer direction:` is a bare "none": give the reason after the dash (`none — <why no maintainer direction applies>`), and when you cite maintainer comments include `Fixer self-check:` with R1, R2… for each.

   End your turn after sending. The review takes ~20-30 min; status echoes get no reply (chain-reporting quietness rule).

   On the reviewer's substantive reply:
   - APPROVE → the **Report** step.
   - APPROVE_WITH_NITS → apply the nits, re-run **Fix + verify**, re-push; no new review round; the **Report** step.
   - REQUEST_CHANGES (or any critical/high finding) → apply edits, re-run **Fix + verify**, re-push (or regenerate the patch), re-send. **Two review rounds at most** — then ship the better diff and list the unresolved feedback in the report.

   If `slang-reviewer` isn't in destinations, skip to the **Report** step.

9. **Report + save + refresh PR description** {#report} — Send the [Fix Report] to parent, refresh the concise PR description with the final state, persist a memory file.

   Markdown `- ` bullets with bold field labels (the report-formats table in your spine):

   ```
   send_message(to="parent", in_reply_to=<id-of-triage-handoff>, text="[Fix Report] <repo>#<number>: <title>\n\n- **Status:** <fixed / partial / blocked>\n- **Changes:** <N files, +X / −Y> — <what changed>\n- **Tests:** <repro PASS/FAIL>; broader suite <result>\n- **Review:** <APPROVE / REQUEST_CHANGES / N findings — top concern>\n- **Next:** <draft PR <url> / patch attached / human action needed>")
   ```

   `in_reply_to` names the inbound that dispatched this fix (the triage handoff) so the report routes back up the exact edge — it is **required** on `[Fix Report]` under the chain-routing-gate (`thread_id` is derived from it).

   Refresh the draft PR description with final values in the same concise shape as **Push + draft PR** (Summary, Root cause, Tests, Risk → renamed Review, each at most 2 lines, under 1,000 characters, no tables, `Closes #<n>.`; no files list, no explanation), then `gh pr edit <pr-number> -R shader-slang/slang --body-file <file>`. The explanation comment is separate and already follows the head.

   Persist the run to `/workspace/agent/memory/fix-<number>.md`: title, date, status, worktree path, branch, files changed, test result, PR/patch URL.

   Leave the active-work sentinel in place — stale sentinels (>30 min) are ignored by the next claimer.

## Sequential processing

Multiple issues queued: process ONE at a time (steps 1-9 fully before the next). Max 2 parallel MCP calls. Between issues: `send_message(text="Fixing <N>/<total>: #<number>...")`.
