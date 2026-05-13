---
name: slang-fix-issue
license: MIT
type: workflow
description: "Fix a triaged Slang issue: clone repo, write repro test, implement fix, format, verify."
extends: implement
requires: [code.build, code.edit, test.run]
uses:
  skills: [slang-build, slang-code-writer, slang-code-reader]
  workflows: []
---

# /slang-fix-issue — Implement a Fix for a Triaged Slang Issue

Use when you receive a triage handoff from slang-triage, or when asked to fix a specific Slang issue.

**A/B TEST MODE: Do NOT push, do NOT create PRs, do NOT post comments on GitHub. All work stays local. Report results to parent via send_message.**

## Step 0: ENSURE LOCAL REPO {#setup}

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

## Step 1: UNDERSTAND the issue {#understand}

Read the triage handoff message. Extract:
- Issue number and repo
- What's broken (symptom)
- Relevant files from triage
- Repro steps if provided

If triage info is insufficient, research via DeepWiki + GitHub:
```
mcp__deepwiki__ask_question("shader-slang/slang", "<question about the component>")
mcp__slang-mcp__github_get_file_contents(owner="shader-slang", repo="slang", path="<relevant file>")
```

## Step 2: CREATE repro test {#repro}

Write a test that demonstrates the bug:

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

## Step 3: IMPLEMENT the fix {#fix}

Make targeted, minimal changes:
- Study the relevant source identified in triage
- Follow existing code style
- Focus on root cause, not symptoms
- One logical change per issue

```bash
cd /workspace/agent/slang
# Edit the source files
```

## Step 4: VERIFY the fix {#verify}

Run the repro test — it should PASS now:
```bash
cd /workspace/agent/slang && python -m pytest tests/<area>/test_<issue_number>.py -x 2>&1 | tail -20
```

Run broader tests to check for regressions:
```bash
cd /workspace/agent/slang && python -m pytest tests/ -x --timeout=120 2>&1 | tail -30
```

If tests fail, iterate on the fix (go back to Step 3).

## Step 4.5: PEER REVIEW (only if `slang-reviewer` is in your destinations) {#peer-review}

If `slang-reviewer` is in your destinations, send the diff for peer review BEFORE reporting to parent. The reviewer will return a verdict + suggestions; treat it like a real code review.

```
send_message(to="slang-reviewer", text="[Fix Review Request] <repo>#<number>: <title>\n\nDiff:\n```\n<git diff output>\n```\n\nTests added: tests/<path>\nTest results: <PASS / X failures>\n\nReview for: correctness, edge cases, style, test coverage. Reply APPROVE or REQUEST_CHANGES with specific suggestions.")
```

End your turn after sending. The reviewer's reply will arrive as a new inbound and trigger your next turn.

**On the reviewer's reply (next turn):**
- If APPROVE → proceed to Step 5
- If REQUEST_CHANGES → apply the suggested edits, re-run Step 4 (verify), then re-send to reviewer if changes are non-trivial. Two review rounds max — after that, take the better of the two diffs and proceed to Step 5 noting unresolved feedback in the report.

If `slang-reviewer` is NOT in your destinations (current setup), skip this step and go directly to Step 5.

## Step 5: REPORT to parent (MANDATORY) {#report}

**Do NOT push or create a PR.** Report results to parent:

```
send_message(text="[Fix Report] <repo>#<number>: <title>\n\nStatus: <fixed / partial / blocked>\n\nChanges:\n- <file>: <what changed>\n\nTest:\n- tests/<path>: <PASS/FAIL>\n- Broader suite: <PASS/X failures>\n\nDiff summary:\n```\n<git diff --stat output>\n```\n\nNotes:\n<any caveats, edge cases, or follow-up needed>")
```

## Step 6: SAVE work locally {#save}

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
1. ONE issue at a time (Steps 0-6 fully before next)
2. Max 2 parallel MCP calls
3. Report progress: `send_message(text="Fixing <N>/<total>: #<number>...")`
