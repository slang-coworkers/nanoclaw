---
name: slang-triage-issue
license: MIT
type: workflow
description: "Triage a Slang GitHub issue (shader-slang/slang): read, research via DeepWiki + slang-mcp, classify, report to parent, forward to slang-fixer, then forward fixer's resolution back upstream when it lands."
requires: [issues.read, code.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
---

# /slang-triage-issue — Triage a Slang GitHub Issue

Slang-specific triage workflow. Use when asked to triage an issue on `shader-slang/slang`, or when the orchestrator forwards a Slang issue for analysis.

**Read-only triage.** You NEVER post comments, create labels, or modify anything on GitHub. All output flows back to your parent via `send_message(to="parent")` per the chain-reporting protocol.

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

5. **Report initial triage to parent (mandatory)** {#report} — `send_message(to="parent")` with the [Triage] 5-bullet so your parent has the classification before any fix work begins. This is the *initial* report; the *resolution* comes in Step 8 after the downstream chain reports back.

   ```
   send_message(to="parent", text="[Triage] shader-slang/slang#<number>: <title>\n\n• Classification: <category> / <severity> / <component> / <priority>\n• Summary: <one-line of the bug>\n• Relevant code: <top 1–2 file paths>\n• Related: <duplicate of #X / fix in flight #Y / no prior work>\n• Routing: <forwarding to slang-fixer / not actionable — reason>")
   ```

   The full classification + research notes go into Step 7 memory; the bullets are the scannable signal.

6. **Forward to slang-fixer (if actionable)** {#forward} — if the issue is actionable (bug or regression with clear repro), forward to the fixer. Send the handoff as a `[Triage handoff]` message; the fixer's workflow handles the rest.

   ```
   send_message(to="slang-fixer", text="[Triage handoff] shader-slang/slang#<number>: <title>\n\nPriority: <pri>\nComponent: <comp>\n\nSummary: <what's broken>\nRelevant files: <paths>\nRepro: <steps>")
   ```

   If not actionable (feature request, needs-more-info, question), skip this step and note in Step 5's "Routing" bullet why.

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

8. **Forward resolution upstream (when fixer reports back)** {#forward-up} — your downstream chain (fixer → reviewer → fixer) takes 30–60 min. When a `[Fix Report]` arrives in your inbound, **the chain isn't closed until you forward the resolution to your parent.** Compile the [Triage Resolution] 5-bullet from the fixer's report and send up:

   ```
   send_message(to="parent", text="[Triage Resolution] shader-slang/slang#<number>: <title>\n\n• Outcome: <fixed / partial / blocked / abandoned>\n• Draft PR: <url-or-'patch only, no PR'>\n• Review: <APPROVE / REQUEST_CHANGES / N findings — top concern> (A: <verdict>; B: <verdict or skipped>)\n• Tests: <repro PASS/FAIL>; broader suite <result>\n• Next human action: <merge draft / address review / coordinate / close as wontfix / none>")
   ```

   If the fixer's report is partial or blocked, still forward the resolution — substitute "blocked: <reason>" in the relevant bullets. Orchestrator needs to know the chain is closed even when the result is incomplete.

   **Quietness rule while waiting.** Don't reply to status echoes during the long downstream wait:

   - **Substantive — RESPOND:** `[Fix Report]` arrives (proceed with this step); fixer reports a blocker or asks for direction; new instructions arrive from your parent (e.g. "abort", "change scope").
   - **No-op — END YOUR TURN SILENTLY:** status echo from fixer ("working on it"); polite ack from your parent ("got it", "👍"); generic "still waiting" messages; any inbound with no new artifact, decision, error, or instruction.

   Acknowledgments add no information — the peer already knows your state from your last outbound. End the turn silently and the loop dies on its own.

## Batch Mode

When asked to triage multiple issues:

1. Process ONE issue at a time (Steps 1–8 fully before next)
2. Max 2 parallel MCP calls at any time
3. Send progress: `send_message(to="parent", text="Triaging <N>/<total>: #<number>...")`
