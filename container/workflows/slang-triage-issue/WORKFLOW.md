---
name: slang-triage-issue
license: MIT
type: workflow
description: "Triage a Slang GitHub issue (shader-slang/slang): read, research, classify, report to parent, forward to slang-fixer, then forward fixer's resolution back upstream when it lands."
requires: [issues.read, code.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
---

# /slang-triage-issue — Triage a Slang GitHub Issue

Read-only workflow. **Never** post comments, create labels, or modify anything on GitHub. All output flows back to your parent via `send_message(to="parent")`.

## Steps

1. **Read** {#read} — `gh issue view <number> -R shader-slang/slang --comments`. Extract: what's broken or being requested, error messages + repro, Slang versions / targets (HLSL, GLSL, SPIR-V, Metal, WGSL, CUDA), affected component (frontend, IR, target-emit, autodiff, modules, language-server), confirmations from other users.

2. **Recall** {#recall} — Spawn an `Agent` subagent to scan prior triage learnings before researching:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang issue #<number>'s topic, prior triage patterns, or duplicate-resolution heuristics. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Research** {#research} — Two paths, run in parallel:

   **DeepWiki** (mandatory — at least one focused question, two if the first doesn't cover the issue's area):
   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<focused question>")
   ```
   Good queries: "How does the <target> backend handle <feature>?", "What is the architecture of <pass>?", "What are the known limitations of <feature> on <target>?"

   **slang-mcp** (mandatory — find duplicates, prior fixes, relevant source):
   ```
   mcp__slang-mcp__github_search_issues(query="<keywords>", repo="shader-slang/slang")
   mcp__slang-mcp__github_get_file_contents(owner="shader-slang", repo="slang", path="<relevant file>")
   ```
   Slang has many long-running tracking issues; check duplicates carefully. For source, target the component named in the issue (`source/slang/slang-emit-*.cpp`, `slang-ir-*.cpp`, `slang-check-*.cpp`).

4. **Classify** {#classify} —

   | Field | Options |
   |---|---|
   | Category | bug / feature-request / regression / enhancement / question / documentation |
   | Severity | critical / high / medium / low |
   | Component | frontend / IR / target-emit (HLSL/GLSL/SPIR-V/Metal/WGSL/CUDA) / autodiff / modules / language-server / CI / docs |
   | Priority | P0 ship-stopper / P1 regression / P2 normal / P3 nice-to-have |
   | Duplicate? | link to existing issue, or "no" |

5. **Report + persist** {#report} — Send the [Triage] 5-bullet to parent so they have classification before any fix work. Save the full notes to memory in the same step (one transcript file, easy to find later).

   ```
   send_message(to="parent", text="[Triage] shader-slang/slang#<number>: <title>\n\n• Classification: <category> / <severity> / <component> / <priority>\n• Summary: <one-line of the bug>\n• Relevant code: <top 1–2 file paths>\n• Related: <duplicate of #X / fix in flight #Y / no prior work>\n• Routing: <forwarding to slang-fixer / not actionable — reason>")
   ```

   ```bash
   cat > /workspace/agent/memory/triage-<number>.md << 'EOF'
   # Triage: shader-slang/slang#<number> — <title>
   Date: <ISO timestamp> | Category: <cat> | Severity: <sev> | Priority: <pri> | Component: <comp>

   ## Summary
   <findings>

   ## Sources
   - <links>

   ## Action
   <forwarded to slang-fixer / needs more info / duplicate of #X>
   EOF
   ```

6. **Forward to slang-fixer (if actionable)** {#forward} — Bug or regression with a clear repro? Hand off:

   ```
   send_message(to="slang-fixer", text="[Triage handoff] shader-slang/slang#<number>: <title>\n\nPriority: <pri>\nComponent: <comp>\n\nSummary: <what's broken>\nRelevant files: <paths>\nRepro: <steps>")
   ```

   Not actionable (feature request, needs-more-info, question)? Skip; note the reason in Step 5's `Routing:` bullet.

7. **(Async) Forward resolution upstream** {#forward-up} — The fixer → reviewer → fixer chain takes 30-60 min. **The triage chain isn't closed until you forward the resolution to your parent.** When `[Fix Report]` lands in inbound, compile the [Triage Resolution] 5-bullet and send up:

   ```
   send_message(to="parent", text="[Triage Resolution] shader-slang/slang#<number>: <title>\n\n• Outcome: <fixed / partial / blocked / abandoned>\n• Draft PR: <url-or-'patch only, no PR'>\n• Review: <APPROVE / REQUEST_CHANGES / N findings — top concern> (A: <verdict>; B: <verdict or skipped>)\n• Tests: <repro PASS/FAIL>; broader suite <result>\n• Next human action: <merge draft / address review / coordinate / close as wontfix / none>")
   ```

   For partial/blocked outcomes, still forward — substitute "blocked: <reason>" in the relevant bullets. Orchestrator needs to know the chain closed even when incomplete.

   **Quietness while waiting.** Don't reply to status echoes during the long wait. Substantive inbounds (fix-report, blocker, abort) → respond. Status-only inbounds (acks, "still waiting", emoji) → end the turn silently. Per `### Reporting upstream` invariant.

## Batch mode

Triaging multiple issues: process ONE at a time (Steps 1-6 fully before next), max 2 parallel MCP calls, send `send_message(to="parent", text="Triaging <N>/<total>: #<number>...")` between issues.
