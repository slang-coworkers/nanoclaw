---
name: triage-issue
license: MIT
type: workflow
description: "Triage a GitHub issue: read, research, classify, report, forward to fixer. Sequential steps, each mandatory."
requires: [issues.read, code.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
---

# /triage-issue — Triage a GitHub Issue

Use this workflow when asked to triage an issue, or when the orchestrator forwards an issue for analysis.

**A/B test mode: NEVER post comments, create labels, or modify anything on GitHub. All output goes to parent via send_message.**

## Step 1: READ the issue {#read}

```bash
gh issue view <number> -R <repo> --comments
```

Extract:
- What the reporter is experiencing or requesting
- Error messages, repro steps, versions mentioned
- Component/area affected
- Whether others confirmed or provided additional context

## Step 2: RESEARCH via DeepWiki (MANDATORY) {#research-docs}

Query DeepWiki for relevant project documentation:

```
mcp__deepwiki__ask_question("<repo-owner>/<repo>", "<focused question about the issue's domain>")
```

Ask at least ONE question. Ask a SECOND if the first doesn't fully cover the issue's area. Good queries:
- "How does <affected component> work in <project>?"
- "What is the architecture of <subsystem>?"
- "What are the known limitations of <feature>?"

## Step 3: RESEARCH via GitHub (MANDATORY) {#research-code}

Search for related context:

```
mcp__slang-mcp__github_search_issues(query="<keywords>", repo="<repo>")
mcp__slang-mcp__github_get_file_contents(owner="<owner>", repo="<repo>", path="<relevant file>")
```

Find:
- Related issues (duplicates, prior reports)
- Related PRs (past fixes in same area)
- Relevant source code (the component mentioned in the issue)

## Step 4: CLASSIFY {#classify}

Based on research, determine:

| Field | Options |
|-------|---------|
| Category | bug / feature-request / regression / enhancement / question / documentation |
| Severity | critical / high / medium / low |
| Component | (project-specific: e.g. CUDA backend, tensor dispatch, CI/wheels) |
| Priority | P0 (ship-stopper) / P1 (regression/broken) / P2 (normal) / P3 (nice-to-have) |
| Duplicate? | Link to existing issue if duplicate |

## Step 5: REPORT to parent (MANDATORY) {#report}

Send the triage report to parent. This step is NOT optional.

```
send_message(text="[Triage] <repo>#<number>: <title>\n\nCategory: <cat>\nSeverity: <sev>\nComponent: <comp>\nPriority: <pri>\n\nSummary:\n<2-3 sentence summary>\n\nRelevant code:\n- <file paths>\n\nRelated issues:\n- #<num>: <title>\n\nRecommendation: <fix approach or 'needs more info'>\n\nSources:\n- <deepwiki finding>\n- <github links>")
```

## Step 6: FORWARD to fixer (if actionable) {#forward}

If the issue is actionable (bug or regression with clear repro), forward to the fixer:

```
send_message(to="slang-fixer", text="[Triage handoff] <repo>#<number>: <title>\n\nPriority: <pri>\nComponent: <comp>\n\nSummary: <what's broken>\nRelevant files: <paths>\nRepro: <steps>\n\nPlease investigate and draft a fix. Do NOT push or create a PR — report back when done.")
```

If not actionable (feature request, needs-more-info, question), skip this step and note in the report why.

## Step 7: SAVE to memory {#save}

```bash
cat > /workspace/agent/memory/triage-<number>.md << 'EOF'
# Triage: <repo>#<number> — <title>
Date: <ISO timestamp>
Category: <cat> | Severity: <sev> | Priority: <pri>
Component: <comp>

## Summary
<findings>

## Sources
- <links>

## Action
<forwarded to fixer / needs more info / duplicate of #X>
EOF
```

## Batch Mode

When asked to triage multiple issues:
1. Process ONE issue at a time (Steps 1-7 fully before next)
2. Max 2 parallel MCP calls at any time
3. Send progress: `send_message(text="Triaging <N>/<total>: #<number>...")`
