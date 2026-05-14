---
name: slang-triage-issue
license: MIT
type: workflow
description: "Triage a Slang GitHub issue (shader-slang/slang): read, research via DeepWiki + slang-mcp, classify, report to parent, forward to slang-fixer. Sequential steps, each mandatory."
requires: [issues.read, code.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
---

# /slang-triage-issue — Triage a Slang GitHub Issue

Slang-specific overlay of the generic `/triage-issue` workflow. Use when asked to triage an issue on `shader-slang/slang`, or when the orchestrator forwards a Slang issue for analysis.

**A/B test mode: NEVER post comments, create labels, or modify anything on GitHub. All output goes to parent via send_message.**

## Steps

1. **Read the issue** {#read}

   ```bash
   gh issue view <number> -R shader-slang/slang --comments
   ```

   Extract:

   - What the reporter is experiencing or requesting
   - Error messages, repro steps, Slang versions / targets mentioned (HLSL, GLSL, SPIR-V, Metal, WGSL, CUDA, etc.)
   - Component/area affected (frontend parser, IR, target emit, autodiff, modules, language-server, etc.)
   - Whether others confirmed or provided additional context

2. **Research via DeepWiki (mandatory)** {#research-docs} — query DeepWiki for relevant Slang documentation.

   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<focused question about the issue's domain>")
   ```

   Ask at least ONE question. Ask a SECOND if the first doesn't fully cover the issue's area. Good Slang queries:

   - "How does the <target> backend handle <feature>?"
   - "What is the architecture of the autodiff pass / generic-specialization pass / IR linking?"
   - "What are the known limitations of <feature> on <target>?"

3. **Research via slang-mcp (mandatory)** {#research-code} — search the shader-slang/slang repo for related context.

   ```
   mcp__slang-mcp__github_search_issues(query="<keywords>", repo="shader-slang/slang")
   mcp__slang-mcp__github_get_file_contents(owner="shader-slang", repo="slang", path="<relevant file>")
   ```

   Find:

   - Related issues (duplicates, prior reports — Slang has many long-running tracking issues)
   - Related PRs (past fixes in same area)
   - Relevant source code (the component mentioned in the issue, e.g. `source/slang/slang-emit-*.cpp`, `source/slang/slang-ir-*.cpp`, `source/slang/slang-check-*.cpp`)

4. **Classify** {#classify} — based on research, determine:

   | Field | Options |
   |-------|---------|
   | Category | bug / feature-request / regression / enhancement / question / documentation |
   | Severity | critical / high / medium / low |
   | Component | frontend / IR / target-emit (HLSL/GLSL/SPIR-V/Metal/WGSL/CUDA) / autodiff / modules / language-server / CI / docs |
   | Priority | P0 (ship-stopper) / P1 (regression/broken) / P2 (normal) / P3 (nice-to-have) |
   | Duplicate? | Link to existing issue if duplicate |

5. **Report to parent (mandatory)** {#report} — send the triage report to parent. This step is NOT optional.

   ```
   send_message(text="[Triage] shader-slang/slang#<number>: <title>\n\nCategory: <cat>\nSeverity: <sev>\nComponent: <comp>\nPriority: <pri>\n\nSummary:\n<2-3 sentence summary>\n\nRelevant code:\n- <file paths>\n\nRelated issues:\n- #<num>: <title>\n\nRecommendation: <fix approach or 'needs more info'>\n\nSources:\n- <deepwiki finding>\n- <github links>")
   ```

6. **Forward to slang-fixer (if actionable)** {#forward} — if the issue is actionable (bug or regression with clear repro), forward to the Slang fixer:

   ```
   send_message(to="slang-fixer", text="[Triage handoff] shader-slang/slang#<number>: <title>\n\nPriority: <pri>\nComponent: <comp>\n\nSummary: <what's broken>\nRelevant files: <paths>\nRepro: <steps>\n\nPlease investigate and draft a fix. Do NOT push or create a PR — report back when done.")
   ```

   If not actionable (feature request, needs-more-info, question), skip this step and note in the report why.

7. **Save to memory** {#save}

   ```bash
   cat > /workspace/agent/memory/triage-<number>.md << 'EOF'
   # Triage: shader-slang/slang#<number> — <title>
   Date: <ISO timestamp>
   Category: <cat> | Severity: <sev> | Priority: <pri>
   Component: <comp>

   ## Summary
   <findings>

   ## Sources
   - <links>

   ## Action
   <forwarded to slang-fixer / needs more info / duplicate of #X>
   EOF
   ```

## Batch Mode

When asked to triage multiple issues:

1. Process ONE issue at a time (Steps 1–7 fully before next)
2. Max 2 parallel MCP calls at any time
3. Send progress: `send_message(text="Triaging <N>/<total>: #<number>...")`
