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

**A/B TEST MODE: Do NOT push, do NOT create PRs, do NOT post comments on GitHub. All work stays local. Report results to parent via send_message.**

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

7. **Peer review (only if `slang-reviewer` is in your destinations)** {#peer-review} — if `slang-reviewer` is in your destinations, send the diff for peer review BEFORE reporting to parent. The reviewer runs the slang-pr-review workflow on the slang-reviewer agent (production claude-code-action PR-review pipeline) and accepts three input modes — `pr` (PR URL), `branch`, or `patch`. **A/B-test mode fixer doesn't push or open a PR**, so the only valid input here is `patch`.

   Save the diff as a patch file in the workspace, then send the path to the reviewer:

   ```bash
   cd /workspace/agent/slang
   mkdir -p /workspace/agent/patches
   git diff main HEAD > /workspace/agent/patches/fix-<issue_number>.patch
   ```

   ```
   send_file(to="slang-reviewer", path="/workspace/agent/patches/fix-<issue_number>.patch", text="[Fix Review Request] shader-slang/slang#<number>: <title>\n\nMode: patch\nBase: shader-slang/slang@main\n\nTests added: tests/<area>/test_<issue_number>.py\nTest results: <PASS / X failures>\n\nPlease run /slang-pr-review --patch <attached> --base shader-slang/slang@main and reply APPROVE or REQUEST_CHANGES with specific suggestions.")
   ```

   End your turn after sending. The reviewer's reply (with `final-review.md` attached and a severity-counts summary) arrives as a new inbound and triggers your next turn.

   **Quietness rule while waiting on the reviewer.** Reviewer A's claude pipeline runs ~20–30 min. While that's in flight, your only obligation is to wait. If an inbound arrives during that window:

   - **Substantive — RESPOND:** the reviewer attached `final-review.md` + severity counts; reviewer issued an APPROVE/REQUEST_CHANGES verdict; reviewer or parent reports an error or blocker; new instructions arrive (e.g. "restart on a different patch", "stop and report"); your own background process completed with new artifacts.
   - **No-op — END YOUR TURN SILENTLY (do not reply):** status echo from the reviewer ("running review", "still in progress"); polite ack from your parent ("got it", "👍"); generic "waiting" / "standing by" messages; any inbound that contains no new artifact, no decision, no error, no new instruction.

   Acknowledgments add no information; the peer already knows your state from your last outbound. Replying to a status-only inbound just wakes the peer, who acks back, who wakes you again — wasting tokens until the long operation breaks the cycle. End the turn silently and the loop dies on its own.

   **On the reviewer's substantive reply (next turn):**
   - If APPROVE or 0 critical/high findings → proceed to Step 8; attach the review summary to your parent report
   - If REQUEST_CHANGES or critical/high findings → apply the suggested edits, re-run Step 6 (verify), regenerate the patch, then re-send to reviewer. Two review rounds max — after that, take the better of the two diffs and proceed to Step 8 noting unresolved feedback in the report

   If `slang-reviewer` is NOT in your destinations (current setup), skip this step and go directly to Step 8.

8. **Report to parent (mandatory)** {#report} — do NOT push or create a PR. Report results to parent:

   ```
   send_message(text="[Fix Report] <repo>#<number>: <title>\n\nStatus: <fixed / partial / blocked>\n\nChanges:\n- <file>: <what changed>\n\nTest:\n- tests/<path>: <PASS/FAIL>\n- Broader suite: <PASS/X failures>\n\nDiff summary:\n```\n<git diff --stat output>\n```\n\nNotes:\n<any caveats, edge cases, or follow-up needed>")
   ```

9. **Save work locally** {#save} — stash the changes and write a memory file. Leave the active-work sentinel in place; it serves as a "this issue was worked on by session X at time T" record. Stale sentinels are ignored by the next claimer.

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

1. ONE issue at a time (Steps 1–9 fully before next)
2. Max 2 parallel MCP calls
3. Report progress: `send_message(text="Fixing <N>/<total>: #<number>...")`
