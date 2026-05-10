---
name: fix-issue
license: MIT
type: workflow
description: "Fix a triaged issue: clone repo, write repro test, implement fix, format, verify. Sequential steps. A/B test mode: NO push, NO PR creation."
extends: implement
requires: [code.build, code.edit, test.run]
uses:
  skills: [slang-build, slang-code-writer, slang-code-reader]
  workflows: []
---

# /fix-issue — Implement a Fix for a Triaged Issue

Use when you receive a triage handoff from slang-triage, or when asked to fix a specific issue.

**A/B TEST MODE: Do NOT push, do NOT create PRs, do NOT post comments on GitHub. All work stays local. Report results to parent via send_message.**

## Step 0: ENSURE LOCAL REPO {#setup}

```bash
[ -d /workspace/agent/slangpy/.git ] && echo "REPO_READY" || echo "NEEDS_CLONE"
```

If `NEEDS_CLONE`:
```bash
git clone --depth 50 https://github.com/shader-slang/slangpy.git /workspace/agent/slangpy
```

Then update:
```bash
cd /workspace/agent/slangpy && git fetch origin && git checkout main && git pull
```

## Step 1: UNDERSTAND the issue {#understand}

Read the triage handoff message. Extract:
- Issue number and repo
- What's broken (symptom)
- Relevant files from triage
- Repro steps if provided

If triage info is insufficient, research via DeepWiki + GitHub:
```
mcp__deepwiki__ask_question("shader-slang/slangpy", "<question about the component>")
mcp__slang-mcp__github_get_file_contents(owner="shader-slang", repo="slangpy", path="<relevant file>")
```

## Step 2: CREATE repro test {#repro}

Write a test that demonstrates the bug:

```bash
cd /workspace/agent/slangpy
# Create test file in appropriate test directory
cat > tests/<area>/test_<issue_number>.py << 'EOF'
"""Repro test for issue #<number>: <title>"""
<test code that fails before fix>
EOF
```

Verify the test FAILS (confirming the bug exists):
```bash
cd /workspace/agent/slangpy && python -m pytest tests/<area>/test_<issue_number>.py -x 2>&1 | tail -20
```

If you can't reproduce, report to parent and stop.

## Step 3: IMPLEMENT the fix {#fix}

Make targeted, minimal changes:
- Study the relevant source identified in triage
- Follow existing code style
- Focus on root cause, not symptoms
- One logical change per issue

```bash
cd /workspace/agent/slangpy
# Edit the source files
```

## Step 4: VERIFY the fix {#verify}

Run the repro test — it should PASS now:
```bash
cd /workspace/agent/slangpy && python -m pytest tests/<area>/test_<issue_number>.py -x 2>&1 | tail -20
```

Run broader tests to check for regressions:
```bash
cd /workspace/agent/slangpy && python -m pytest tests/ -x --timeout=120 2>&1 | tail -30
```

If tests fail, iterate on the fix (go back to Step 3).

## Step 5: REPORT to parent (MANDATORY) {#report}

**Do NOT push or create a PR.** Report results to parent:

```
send_message(text="[Fix Report] <repo>#<number>: <title>\n\nStatus: <fixed / partial / blocked>\n\nChanges:\n- <file>: <what changed>\n\nTest:\n- tests/<path>: <PASS/FAIL>\n- Broader suite: <PASS/X failures>\n\nDiff summary:\n```\n<git diff --stat output>\n```\n\nNotes:\n<any caveats, edge cases, or follow-up needed>")
```

## Step 6: SAVE work locally {#save}

```bash
cd /workspace/agent/slangpy
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
