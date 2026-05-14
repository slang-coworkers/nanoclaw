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

**Read-only triage.** You NEVER post comments, create labels, or modify anything on GitHub. All output flows back to your parent (the orchestrator) via `send_message(to="parent")`. Downstream agents (slang-fixer) may push branches and open **draft PRs** under their own workflow rules — that's their decision, not yours.

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

5. **Report initial triage to parent (mandatory)** {#report} — send a tight 5-bullet summary to your parent (the orchestrator) so they know the classification before any fix work begins. This is NOT the final summary — that comes in Step 8 after slang-fixer reports back.

   ```
   send_message(to="parent", text="[Triage] shader-slang/slang#<number>: <title>\n\n• Classification: <category> / <severity> / <component> / <priority>\n• Summary: <one-line of the bug>\n• Relevant code: <top 1–2 file paths>\n• Related: <duplicate of #X / fix in flight #Y / no prior work>\n• Routing: <forwarding to slang-fixer / not actionable — reason>")
   ```

   Five bullets, no more. The full classification + research notes go into Step 7 memory; the bullets are what your parent reads.

6. **Forward to slang-fixer (if actionable)** {#forward} — if the issue is actionable (bug or regression with clear repro), forward to the Slang fixer. Slang-fixer's workflow allows pushing a branch + opening a **draft PR** to a fork (so Reviewer B / Devin can run); they'll fall back to patch mode if no fork has push rights. Either way, they'll report back here with their result.

   ```
   send_message(to="slang-fixer", text="[Triage handoff] shader-slang/slang#<number>: <title>\n\nPriority: <pri>\nComponent: <comp>\n\nSummary: <what's broken>\nRelevant files: <paths>\nRepro: <steps>\n\nPlease investigate and draft a fix. You may push a branch + open a draft PR if you have push rights to a fork — otherwise fall back to patch mode. Report back with a 5-bullet [Fix Report].")
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

8. **Forward fixer's resolution upstream (when it arrives)** {#forward-up} — slang-fixer reports back via `send_message(to="parent")` with a `[Fix Report]` once their work is done (fixed / partial / blocked, including the draft PR url and review verdict). That message wakes your session as a new inbound. **The chain isn't closed until orchestrator hears about the resolution.**

   When you receive a `[Fix Report]` inbound from slang-fixer:

   - **Compile a chain summary.** Pull the key fields from the fixer's 5 bullets — status, draft PR url (if any), review verdict, next-action.
   - **Forward 5 bullets up to orchestrator** via `send_message(to="parent")`:

   ```
   send_message(to="parent", text="[Triage Resolution] shader-slang/slang#<number>: <title>\n\n• Outcome: <fixed / partial / blocked / abandoned>\n• Draft PR: <url-from-fixer-report-or-'patch only, no PR'>\n• Review: <APPROVE / REQUEST_CHANGES / N findings — top concern> (Reviewer A: <verdict>; Reviewer B: <verdict or skipped>)\n• Tests: <repro PASS/FAIL>; broader suite <result>\n• Next human action: <merge draft PR / address review / coordinate with maintainer X / close as wontfix / none>")
   ```

   Five bullets. Orchestrator sees this and the user can decide what to do (promote draft to ready-for-review, merge, etc.).

   **If fixer's report is partial or blocked** (no PR url, missing review, etc.), still forward the 5-bullet resolution — substitute "blocked: <reason>" in the relevant bullets. Orchestrator needs to know the chain is closed even when the result is incomplete.

   **Quietness rule while waiting on slang-fixer's report.** Slang-fixer's full workflow (clone, repro, fix, build, peer-review) takes 30–60 min. If an inbound arrives during that window:

   - **Substantive — RESPOND:** the fixer sends `[Fix Report]` (proceed with this Step 8); fixer reports a blocker or asks for direction; new instructions arrive from orchestrator (e.g. "abort", "change scope"); fixer's review surfaces a `REQUEST_CHANGES` you need to relay.
   - **No-op — END YOUR TURN SILENTLY (do not reply):** status echo from the fixer ("working on it", "build in progress"); polite ack from orchestrator ("got it", "👍"); generic "still waiting" messages; any inbound that contains no new artifact, no decision, no error, no new instruction.

   Acknowledgments add no information; the peer already knows your state from your last outbound. Replying to a status-only inbound just wakes the peer, who acks back, who wakes you again — wasting tokens until the long operation breaks the cycle. End the turn silently.

## Batch Mode

When asked to triage multiple issues:

1. Process ONE issue at a time (Steps 1–8 fully before next)
2. Max 2 parallel MCP calls at any time
3. Send progress: `send_message(to="parent", text="Triaging <N>/<total>: #<number>...")`
