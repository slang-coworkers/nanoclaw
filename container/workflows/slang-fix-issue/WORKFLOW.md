---
name: slang-fix-issue
license: MIT
type: workflow
description: "Fix a triaged Slang issue: setup worktree, write repro test, implement fix, verify, push draft PR, peer review, report."
extends: implement
requires: [code.edit, test.run]
uses:
  skills: [slang-build, slang-code-writer, slang-code-reader]
  workflows: []
---

# /slang-fix-issue — Fix a Triaged Slang Issue

> [!IMPORTANT]
> **Autonomous bug fixing.** A triage handoff (or bug report) means *fix it*, not "ask the user how they want it fixed." Point at logs, errors, the failing test; identify root cause; resolve. Don't pause to ask "is this approach OK?" — propose the fix as a draft PR. The human reviews the artifact, not the plan.

**Draft PR mode.** You MAY push to a fork where you have write rights and open a **draft PR** against `shader-slang/slang:main`. You MAY NOT merge, mark ready-for-review, post on user-facing issues/PRs, or push to upstream. The human gates draft → merge.

**Patch fallback.** If no fork has push rights, attach the `.patch` file to the reviewer message; Reviewer A still runs, Reviewer B (Devin) is skipped.

## Steps

1. **Setup** {#setup} — Active-work claim + worktree + repo, in one pass.

   **[MUST] Auth preflight first.** Before any worktree or clone work, confirm `gh` auth resolves to a real user:

   ```bash
   gh api user --jq .login 2>&1 | head -1
   ```

   If this returns empty / "not authenticated" / "401" / "Bad credentials": **abort immediately** with a blocked Fix Report:
   ```
   send_message(to="parent", text="[Fix Report] shader-slang/slang#<number>: <title>\n\n• Status: blocked — gh auth preflight failed (gh api user returned: <error head>). Token likely missing/expired/scope-insufficient.\n• Next: human / orchestrator intervention to refresh OneCLI token or fork access.")
   ```
   Do not start the worktree, do not attempt `gh pr create` — both will fail later wasting cycles. Observed in slang#10267 fixer: 5+ wasted turns hitting "createPullRequest requires public_repo" before recovering via REST workaround. Preflight catches this in 1 turn.

   Token-good case: continue.

   ```bash
   TARGET="slang-<number>"   # flat name, e.g. slang-10188
   SENTINEL="/workspace/agent/active-work/$TARGET"
   ```

   **If `$SENTINEL` exists with mtime <30 min** — another fixer session is already on this target. Don't start parallel work:
   - **Additive context** (new instructions / fresh constraints in the handoff that the active session doesn't have) → relay to parent, end the turn:
     `send_message(text="Active session already on <target>. Relaying new context for consolidation.")`
   - **Duplicate handoff** → reply once, end:
     `send_message(text="Already working on <target> (started <mtime>). Subscribe to that session for updates.")`

   **Otherwise claim and proceed:**

   ```bash
   mkdir -p "$SENTINEL"
   date -u -Iseconds > "$SENTINEL/started-at"
   echo "<repo>#<number>: <title>" > "$SENTINEL/target"
   ```

   Ensure repo + dedicated worktree (one worktree per issue keeps this session isolated from peers; review comments on this PR can be addressed independently of other in-flight fixes):

   ```bash
   [ -d /workspace/agent/slang/.git ] || git clone --depth 50 https://github.com/shader-slang/slang.git /workspace/agent/slang
   cd /workspace/agent/slang && git fetch origin main && git checkout main && git pull
   git worktree add /workspace/agent/wt-{{target_slug}} -b fix/issue-<number>
   cd /workspace/agent/wt-{{target_slug}}
   ```

   **[MUST NOT] Worktree isolation.** Sibling fixer sessions write to their own `wt-<other-target>/` dirs in the same `groups/slang-fixer/` filesystem; you can SEE them but **never read, write, mv, rm, or `git worktree remove`** them. Cross-session reads can produce silent wrong-source confusion (a fixer probing another's prebuilt slangc); cross-session deletes have caused mid-build failures (concurrent `rm -rf wt-<sibling>/build/` killed an active build). If `/workspace/` runs out of disk, **report `blocked` to parent** with status + `df -h /workspace` output — do **not** reclaim space by deleting sibling worktrees or build dirs.

   - **Paths YOU own (rw):** `wt-{{target_slug}}/`, `active-work/{{target_slug}}/`, `memory/fix-<number>.md`, `patches/fix-<number>.patch`.
   - **Shared (read-only):** `/workspace/agent/slang/` (base clone — `git fetch` only).

2. **Recall** {#recall} — Subagent for prior fixes / similar patterns before researching:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang issue #<number>'s topic or similar fix patterns. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Understand** {#understand} — Read the triage handoff. Extract: issue number, symptom, relevant files, repro steps. If triage info is insufficient, fill in via DeepWiki + slang-mcp:

   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<question about the component>")
   mcp__slang-mcp__github_get_file_contents(owner="shader-slang", repo="slang", path="<relevant file>")
   ```

4. **Reproduce** {#repro} — Write a failing test as a `.slang` file in `tests/<area>/test-<issue_number>.slang`. Use the right directive for the bug:

   - CPU computation: `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type`
   - Interpreter: `//TEST:INTERPRET(filecheck=CHECK):`
   - Diagnostic: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`

   Confirm it fails:

   ```bash
   ./build/Debug/bin/slang-test tests/<area>/test-<issue_number>.slang
   ```

   If you can't reproduce, send `[Fix Report]` to parent with status `blocked: cannot reproduce` and stop. Don't guess the fix without a repro.

5. **Fix + verify** {#fix} — Use `/slang-code-writer`. Keep the change minimal, follow existing style, stay in one subsystem (parser / semantic checker / IR pass / emitter). Prefer IR pass fixes over emit-level workarounds. When fixing emitters, check sibling `slang-emit-*.cpp` for consistency.

   After each edit, rebuild and re-run:

   ```bash
   cmake --build --preset debug >/dev/null 2>&1 || cmake --build --preset debug
   ./build/Debug/bin/slang-test tests/<area>/test-<issue_number>.slang   # repro must PASS now
   ./build/Debug/bin/slang-test tests/<area>/                            # broader regression check
   ./extras/formatting.sh
   ```

   Build is 15-25 min; use the watchdog pattern (notify parent + `schedule_task` watchdog every 30 min, cancel on completion) — see `/slang-implement` Step 5 for the exact template.

   **[MUST] React to build failure on the same turn it surfaces.** When the watchdog (or a `Monitor` tool tail) reports `BUILD_EXIT=<non-zero>`, build failure stderr, ninja `FAILED:` lines, or "command failed" status, do NOT end the turn silently. The next turn must:

   1. Read the last 30 lines of the build log: `tail -n 30 /workspace/agent/wt-{{target_slug}}/build/build.log` (or wherever the watchdog writes output).
   2. If the failure is recoverable (compile error in your patch, missing dep, environment glitch): fix and re-run — counts as 1 of the 2 allowed attempts.
   3. If unrecoverable OR you've used both attempts: commit current state with `wip:` prefix, **send `[Fix Report]` to parent with `Status: blocked`** + first 30 lines of the error tail + what was tried + worktree path. Then `cancel_task(<watchdog-id>)` and end the turn.

   Silent abandonment after a build failure leaves the chain stranded — the orchestrator can't tell "still building" from "broke 2h ago and gave up". Escalate every failure explicitly.

   If verify fails after **2 independent fix attempts** without a watchdog event (e.g., test fails but build succeeds), the same blocked-Fix Report rule applies.

6. **Push + draft PR** {#draft-pr} — Once verify is green, commit and open the draft PR:

   ```bash
   git add -A && git commit -m "Fix shader-slang/slang#<number>: <one-line title>"
   ```

   Resolve fork target — `git remote -v` to find a remote with push rights (e.g. nv-slang-bot fork, or one nominated via `--fork-repo <owner>/<repo>` in the inbound). Push cross-fork and open the draft PR:

   ```bash
   git push <fork-remote> fix/issue-<number>
   gh pr create \
     --repo shader-slang/slang \
     --base main --head "<fork-owner>:fix/issue-<number>" --draft \
     --title "[draft] Fix #<number>: <one-line title>" \
     --body "Draft fix for #<number>. ## Summary <2-3 sentences> ## Changes <file: change> ## Tests <test path: PASS/FAIL>"
   ```

   Capture the PR URL — pass to Step 7.

   **Patch fallback** (no push rights / no usable fork): `git diff main HEAD > /workspace/agent/patches/fix-<issue_number>.patch`. Step 7 dispatches with `--mode patch <path>` instead of the PR URL. Skip Step 6.5 in patch mode (no PR to watch).

   **6.5 Set the PR watcher [MUST]** {#watcher} — Once the draft PR is open, schedule a recurring task that polls for new review comments + state changes and GCs the worktree when the PR closes or ages out. This replaces passive "wait for inbound" with active polling so a long-running review or a closed PR doesn't strand the fixer.

   ```
   echo "0" > /workspace/agent/active-work/{{target_slug}}/last-pr-count

   schedule_task(
     prompt="[PR watcher slang#<number>] " +
       "1. `gh pr view <number> -R shader-slang/slang --json state,createdAt,reviewDecision,comments,reviews,reviewThreads` — capture state + total count of comments+reviews+reviewThreads. " +
       "2. If state ∈ {CLOSED, MERGED}: cleanup. `cancel_task(<this taskId>)`; `cd /workspace/agent/slang && git worktree remove --force /workspace/agent/wt-<target_slug>`; `rm -rf /workspace/agent/active-work/<target_slug>`; `send_message(to='parent', text='[Watcher] slang#<number> PR <state>; worktree GC done.')`. End turn. " +
       "3. If `(now - createdAt) > 10 days`: same cleanup as #2, reason='10d-stale'. " +
       "4. Otherwise: compare current count to `/workspace/agent/active-work/<target_slug>/last-pr-count`. If higher → fetch new comments and address them per Step 7's REQUEST_CHANGES path (apply edits, re-run Step 5 verify, re-push). Update last-pr-count. End turn. " +
       "5. If unchanged: end turn (no message — silent poll).",
     recurrence="*/30 * * * *",
     new_session=false,
   )
   ```

   The watcher self-cancels on PR close/merge or after 10 days. No manual cleanup required.

7. **Peer review** {#peer-review} — When `slang-reviewer` is in your destinations, dispatch with the artifact + test summary:

   ```
   send_message(to="slang-reviewer", text="[Fix Review Request] shader-slang/slang#<number>: <title>\n\nMode: pr (or patch)\nPR / Patch: <url-or-path>\nBase: shader-slang/slang@main\nTests added: tests/<area>/test-<issue_number>.slang\nTest results: <PASS / X failures>")
   ```

   End your turn after sending. Reviewer A's pipeline runs ~20-30 min; **don't reply to status echoes** while you wait — apply the universal quietness protocol from `### Reporting upstream`.

   On the reviewer's substantive reply:
   - APPROVE or 0 critical/high findings → Step 8.
   - REQUEST_CHANGES or critical/high findings → apply edits, re-run Step 5 verify, re-push the branch (or regenerate patch), re-send. **Max 2 review rounds** — after that, take the better diff, proceed to Step 8, note unresolved feedback in the report.

   If `slang-reviewer` isn't in destinations, skip to Step 8.

8. **Report + save** {#report} — Send the [Fix Report] to parent and persist a memory file in one step:

   ```
   send_message(to="parent", text="[Fix Report] <repo>#<number>: <title>\n\n• Status: <fixed / partial / blocked>\n• Changes: <N files, +X / −Y> — <one-line of what changed>\n• Tests: <repro PASS/FAIL>; broader suite <result>\n• Review: <APPROVE / REQUEST_CHANGES / N findings — top concern>\n• Next: <draft PR <url> / patch attached / human action needed>")
   ```

   Persist the run for the next session that touches this target:

   ```bash
   cat > /workspace/agent/memory/fix-<number>.md << 'EOF'
   # Fix: <repo>#<number> — <title>
   Date: <ISO> | Status: <fixed / partial / blocked>
   Worktree: /workspace/agent/wt-<target_slug> | Branch: fix/issue-<number>
   Changes: <files modified>
   Tests: <test path and result>
   PR / Patch: <url or path>
   EOF
   ```

   Leave the active-work sentinel in place — it serves as a "this target was worked on by session X at <time>" record. Stale sentinels (>30 min since update) are ignored by the next claimer.

## Sequential processing

Multiple issues queued: process ONE at a time (Steps 1-8 fully before next). Max 2 parallel MCP calls. Between issues: `send_message(text="Fixing <N>/<total>: #<number>...")`.
