---
name: slang-fix-issue
license: MIT
type: workflow
description: "Fix a triaged Slang issue: claim active-work sentinel, clone repo, write repro test, implement fix, format, verify."
extends: implement
requires: [code.build, code.edit, test.run]
uses:
  skills: [slang-build, slang-code-writer, slang-code-reader]
  workflows: []
---

# /slang-fix-issue — Implement a Fix for a Triaged Slang Issue

Use when you receive a triage handoff from slang-triage, or when asked to fix a specific Slang issue.

**Draft PR mode.** You MAY push your fix branch to a fork where you have push rights, and open a **draft PR** against `shader-slang/slang:main` — this gives Reviewer A and Reviewer B (Devin) a real URL to inspect, and gives the operator a real artifact to iterate on. You MAY NOT: merge the PR, mark it ready-for-review, post comments on user-facing issues/PRs, or push to a repo where you don't have write rights. The human gates the "draft → ready-for-review → merge" transition; you propose the change as a draft.

If no fork has push rights (sandboxed environment, missing remote, etc.), fall back to **patch mode** — attach the .patch file to the reviewer message; Reviewer A still runs, Reviewer B is skipped.

## Steps

1. **Claim active-work sentinel** {#claim} — before doing any work, check whether a peer session of slang-fixer is already on the same target. `/workspace/agent/` is shared across all sessions of this coworker, so the sentinel is visible to peers.

   ```bash
   # Pick a flat target name. Examples:
   #   shader-slang/slang#10188  → slang-10188
   #   shader-slang/slang@feat/x → slang-feat-x
   TARGET="slang-<number-or-flat-branch>"
   SENTINEL="/workspace/agent/active-work/$TARGET"
   mkdir -p /workspace/agent/active-work
   ```

   **If `$SENTINEL` exists AND its mtime is within the last 30 min:** another active session of slang-fixer is already on this target. Read the metadata file inside (`cat $SENTINEL/started-at $SENTINEL/target`), then:

   - **Additive context** (new instructions, fresh constraints, coordination ask not in the original handoff — e.g. "surface draft to <maintainer>", "use approach X", "don't post yet") → relay the new context to your parent so they can route it into the active session, then end your turn:
     ```
     send_message(text="Already have an active session working on <target>. Relaying the new context. Please route any further instructions to the existing session for consolidation.")
     ```
     Do NOT start parallel work.

   - **Duplicate handoff** (same target, no new info) → reply once and end:
     ```
     send_message(text="Already working on <target> in another session (started <mtime>). Ending turn — subscribe to that session for updates.")
     ```

   **If `$SENTINEL` does NOT exist (or its mtime is >30 min stale):** claim it and proceed.

   ```bash
   rm -rf "$SENTINEL"   # cleans stale claim if any
   mkdir -p "$SENTINEL"
   date -u -Iseconds > "$SENTINEL/started-at"
   echo "<repo>#<number>: <title>" > "$SENTINEL/target"
   ```

2. **Ensure local repo** {#setup} — make sure `/workspace/agent/slang` is a usable checkout.

   ```bash
   [ -d /workspace/agent/slang/.git ] && echo "REPO_READY" || echo "NEEDS_CLONE"
   ```

   If `NEEDS_CLONE`:
   ```bash
   git clone --depth 50 https://github.com/shader-slang/slang.git /workspace/agent/slang
   ```

   Then update:
   ```bash
   cd /workspace/agent/slang && git fetch origin && git checkout main && git pull
   ```

3. **Understand the issue** {#understand} — read the triage handoff message. Extract:

   - Issue number and repo
   - What's broken (symptom)
   - Relevant files from triage
   - Repro steps if provided

   If triage info is insufficient, research via DeepWiki + GitHub:

   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<question about the component>")
   mcp__slang-mcp__github_get_file_contents(owner="shader-slang", repo="slang", path="<relevant file>")
   ```

4. **Create repro test** {#repro} — write a test that demonstrates the bug.

   ```bash
   cd /workspace/agent/slang
   # Create test file in appropriate test directory
   cat > tests/<area>/test_<issue_number>.py << 'EOF'
   """Repro test for issue #<number>: <title>"""
   <test code that fails before fix>
   EOF
   ```

   Verify the test FAILS (confirming the bug exists):

   ```bash
   cd /workspace/agent/slang && python -m pytest tests/<area>/test_<issue_number>.py -x 2>&1 | tail -20
   ```

   If you can't reproduce, report to parent and stop.

5. **Implement the fix** {#fix} — make targeted, minimal changes:

   - Study the relevant source identified in triage
   - Follow existing code style
   - Focus on root cause, not symptoms
   - One logical change per issue

   ```bash
   cd /workspace/agent/slang
   # Edit the source files
   ```

6. **Verify the fix** {#verify} — run the repro test — it should PASS now:

   ```bash
   cd /workspace/agent/slang && python -m pytest tests/<area>/test_<issue_number>.py -x 2>&1 | tail -20
   ```

   Run broader tests to check for regressions:

   ```bash
   cd /workspace/agent/slang && python -m pytest tests/ -x --timeout=120 2>&1 | tail -30
   ```

   If tests fail, iterate on the fix (go back to Step 5).

7. **Push branch + open draft PR** {#draft-pr} — share the code change as a real artifact when you have push rights.

   **Resolve fork target.** Inspect existing remotes at `/workspace/agent/slang`:

   ```bash
   cd /workspace/agent/slang
   git remote -v
   ```

   - If a remote exists where you have push rights (e.g. `slang-coworkers/slang`, an `nv-slang-bot` fork, or one nominated by the requester via `--fork-repo <owner>/<repo>` in the inbound) — pick that as `<fork-repo>`. Verify with `gh auth status` + a dry-run `gh repo view <fork-repo>`.
   - If no usable fork remote exists, skip to **patch fallback** below.

   **Push the branch.** Branch name should be flat and topical, e.g. `fix/issue-<number>` or `fix/<short-slug>-<number>`:

   ```bash
   cd /workspace/agent/slang
   BRANCH="fix/issue-<number>"
   git checkout -b "$BRANCH"
   git add -A && git commit -m "Fix shader-slang/slang#<number>: <one-line title>"
   git push <fork-remote> "$BRANCH"
   ```

   **Open the draft PR (cross-fork → shader-slang/slang:main).**

   ```bash
   gh pr create \
     --repo shader-slang/slang \
     --base main \
     --head "<fork-owner>:$BRANCH" \
     --draft \
     --title "[draft] Fix #<number>: <one-line title>" \
     --body "$(cat <<EOF
   Draft fix for #<number>. Not ready for merge — use this PR for review only.

   ## Summary
   <2–3 sentence summary of the bug + fix>

   ## Changes
   - <file>: <what changed>

   ## Tests
   - tests/<area>/...: <PASS/FAIL>
   - Broader suite: <result>

   Closes #<number> (when merged)
   EOF
   )"
   ```

   Capture the resulting PR URL — you'll pass it to the reviewer in Step 8.

   **Patch fallback.** If push fails (no rights, no fork, no network):

   ```bash
   mkdir -p /workspace/agent/patches
   git diff main HEAD > /workspace/agent/patches/fix-<issue_number>.patch
   ```

   Then in Step 8, dispatch with `--mode patch <path>` instead of `--mode pr <N>`. Reviewer A still runs; Reviewer B (Devin) skipped because no PR URL.

8. **Peer review (only if `slang-reviewer` is in your destinations)** {#peer-review} — dispatch to slang-reviewer with the artifact you just produced.

   **PR mode (default — Step 7 succeeded).** Both Reviewer A (claude pipeline) and Reviewer B (Devin) run in parallel.

   ```
   send_message(to="slang-reviewer", text="[Fix Review Request] shader-slang/slang#<number>: <title>\n\nMode: pr\nDraft PR: <pr-url-from-step-7>\nBranch: <fork-owner>:<branch>\nBase: shader-slang/slang@main\n\nTests added: tests/<area>/test_<issue_number>.py\nTest results: <PASS / X failures>\n\nPlease run /slang-pr-review --mode pr --pr <N> --repo shader-slang/slang and reply APPROVE or REQUEST_CHANGES with specific suggestions. Code is on the branch; review commands here.")
   ```

   **Patch mode (Step 7 fell back).** Reviewer A only, Devin skipped.

   ```
   send_file(to="slang-reviewer", path="/workspace/agent/patches/fix-<issue_number>.patch", text="[Fix Review Request] shader-slang/slang#<number>: <title>\n\nMode: patch\nBase: shader-slang/slang@main\n\nTests added: tests/<area>/test_<issue_number>.py\nTest results: <PASS / X failures>\n\nPlease run /slang-pr-review --mode patch --patch <attached> --base shader-slang/slang@main and reply APPROVE or REQUEST_CHANGES with specific suggestions.")
   ```

   End your turn after sending. The reviewer's reply (with `final-review.md` attached and a severity-counts summary) arrives as a new inbound and triggers your next turn.

   **Quietness rule while waiting on the reviewer.** Reviewer A's claude pipeline runs ~20–30 min. While that's in flight, your only obligation is to wait. If an inbound arrives during that window:

   - **Substantive — RESPOND:** the reviewer attached `final-review.md` + severity counts; reviewer issued an APPROVE/REQUEST_CHANGES verdict; reviewer or parent reports an error or blocker; new instructions arrive (e.g. "restart on a different patch", "stop and report"); your own background process completed with new artifacts.
   - **No-op — END YOUR TURN SILENTLY (do not reply):** status echo from the reviewer ("running review", "still in progress"); polite ack from your parent ("got it", "👍"); generic "waiting" / "standing by" messages; any inbound that contains no new artifact, no decision, no error, no new instruction.

   Acknowledgments add no information; the peer already knows your state from your last outbound. Replying to a status-only inbound just wakes the peer, who acks back, who wakes you again — wasting tokens until the long operation breaks the cycle. End the turn silently and the loop dies on its own.

   **On the reviewer's substantive reply (next turn):**
   - If APPROVE or 0 critical/high findings → proceed to Step 9; attach the review summary to your parent report
   - If REQUEST_CHANGES or critical/high findings → apply the suggested edits, re-run Step 6 (verify), regenerate the patch (and re-push the branch + comment on the draft PR if you're in PR mode), then re-send to reviewer. Two review rounds max — after that, take the better of the two diffs and proceed to Step 9 noting unresolved feedback in the report.

   If `slang-reviewer` is NOT in your destinations, skip this step and go directly to Step 9.

9. **Report to parent (mandatory)** {#report} — send a tight 5-bullet executive summary to your parent (the agent that handed off — typically slang-triage). Use `send_message(to="parent")`. Five bullets, no more — your parent will compile their own 5-bullet summary upstream.

   ```
   send_message(to="parent", text="[Fix Report] <repo>#<number>: <title>\n\n• Status: <fixed / partial / blocked>\n• Changes: <N files, +X / −Y> — <one-line of what changed>\n• Tests: <repro test PASS/FAIL>; broader suite <result>\n• Review: <APPROVE / REQUEST_CHANGES / N findings — top concern>\n• Next: <draft PR <url> / patch attached / human action needed>")
   ```

   Anchors for parent (slang-triage) to include in its upstream summary: the **draft PR url** (or "patch only"), the **review verdict**, and the **next-action** the human should take.

10. **Save work locally** {#save} — stash the changes and write a memory file. Leave the active-work sentinel in place; it serves as a "this issue was worked on by session X at time T" record. Stale sentinels are ignored by the next claimer.

   ```bash
   cd /workspace/agent/slang
   git add -A
   git stash save "fix-<issue_number>-$(date +%Y%m%d)"
   ```

   Save report:

   ```bash
   cat > /workspace/agent/memory/fix-<number>.md << 'EOF'
   # Fix: <repo>#<number> — <title>
   Date: <ISO timestamp>
   Status: <fixed / partial / blocked>

   ## Changes
   <list of files modified>

   ## Test
   <test path and result>

   ## Stash
   fix-<number>-<date>
   EOF
   ```

## Sequential Processing

When fixing multiple issues:

1. ONE issue at a time (Steps 1–10 fully before next)
2. Max 2 parallel MCP calls
3. Report progress: `send_message(text="Fixing <N>/<total>: #<number>...")`
