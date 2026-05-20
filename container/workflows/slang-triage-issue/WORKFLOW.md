---
name: slang-triage-issue
license: MIT
type: workflow
description: "Specialist triage of a Slang GitHub issue (shader-slang/slang): research deep, map the solution space, hand off a rich briefing to slang-fixer, then forward fixer's resolution back upstream."
requires: [issues.read, code.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: [slang-plan]
---

# /slang-triage-issue — Specialist triage

You are the **slang specialist** and the first line of engineering on the issue. Investigate. Hand the fixer a briefing they can act on in under a minute: 2-3 approaches with file:line pointers, tradeoffs, recommended path.

Read-only on GitHub: never post, label, or modify anything. Output flows via `send_message`.

## Operating posture

- **Three research pillars: DeepWiki, local code, `gh` CLI.** DeepWiki for architecture Q&A. Subagents read the locally-mounted repo for code (the local checkout IS authoritative — don't fetch what's already there). `gh` for GitHub queries (duplicates, prior PRs, cross-repo). Use `/slang-plan` for non-trivial solution-space work.
- **Always forward to slang-fixer.** No "if actionable" gate. Not-compiler-code (CI yml, docs)? Forward with `not-compiler-code: <where it lives>` and let the fixer/orchestrator route — you don't own the routing decision.
- **Output the solution space.** Handoff with one approach is half a handoff. 2-3 candidates with tradeoffs lets the fixer pick fast and pivot if the first hits a wall.

## Steps

1. **Read the issue** {#read} — `gh issue view <number> -R shader-slang/slang --comments`. Extract: what's broken or being requested, error messages + repro, Slang versions / targets (HLSL, GLSL, SPIR-V, Metal, WGSL, CUDA), affected component, confirmations from other users.

2. **Recall** {#recall} — Spawn an `Agent` subagent to scan prior triage learnings before researching:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slang issue #<number>'s topic, prior triage patterns, or duplicate-resolution heuristics. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Research — three pillars in parallel** {#research} — Fan out via subagents. Cost is your context, not wall clock.

   **Local code (PRIMARY).** The slang checkout is mounted locally. Spawn `Agent` subagents to read it — never read large files inline; the subagent returns a digest, you keep context for the solution-space step.

   ```
   Agent(prompt="Read the local slang checkout for <area>. Find: (1) entry point of <flow>, (2) IR/AST node types involved, (3) where <X> is handled vs unhandled, (4) tests covering the area. Return 10-line digest with file:line pointers and the gap that explains the issue. Don't quote large blocks.")
   ```

   2-3 subagents in parallel for unrelated areas. One per *concern*, not per file. Component-targeted paths: `source/slang/slang-emit-*.cpp` (target emitters), `slang-ir-*.cpp` (IR passes), `slang-check-*.cpp` (semantic analysis).

   **DeepWiki (PRIMARY — ≥2 questions):**
   ```
   mcp__deepwiki__ask_question("shader-slang/slang", "<focused question>")
   ```
   Architecture / flow / limitations questions only — not "what does file X say" (that's local code's job). Examples: *"How does the <target> backend handle <feature>?"*, *"What is the architecture of <pass>?"*, *"What are the known limitations of <feature> on <target>?"*.

   **`gh` CLI (BACKUP — duplicates and cross-repo):**
   ```
   gh issue list -R shader-slang/slang --search "<keywords>" --state all --limit 10
   gh search issues "<keywords>" --owner shader-slang --limit 10
   gh pr list -R shader-slang/slang --search "<keywords>" --state all --limit 5
   ```
   Use `gh` only for what local + DeepWiki can't give: searching the issue tracker for duplicates, prior fixes, related PRs. Slang has many long-running tracking issues; check duplicates carefully.

4. **Map the solution space** {#solution-space} — Don't pick yet. Enumerate. Use `/slang-plan` if it's non-trivial.

   For each candidate approach, write:
   - **Approach name** (one phrase: *"add new IR node"*, *"emit-time guard"*, *"check-time rewrite"*)
   - **Where it lives** (file:line — the spot that changes)
   - **Behaviour delta** (what the user sees)
   - **Tradeoffs** (perf / correctness / maintenance / blast radius)
   - **Risk** (one line: what could go wrong)

   Two minimum, three when they exist. If only one approach is viable, say so explicitly with the constraint that ruled others out — that's a load-bearing finding.

5. **Pick a recommended path** {#recommend} — Not a verdict; a starting point. The fixer can override. Recommend by: *fastest correct fix that doesn't regress adjacent surfaces*. Note explicitly when a recommendation is uncertain.

6. **Classify + persist** {#classify} —

   | Field | Options |
   |---|---|
   | Category | bug / feature-request / regression / enhancement / question / documentation |
   | Severity | critical / high / medium / low |
   | Component | frontend / IR / target-emit (HLSL/GLSL/SPIR-V/Metal/WGSL/CUDA) / autodiff / modules / language-server / CI / docs |
   | Priority | P0 ship-stopper / P1 regression / P2 normal / P3 nice-to-have |
   | Duplicate | link or `no` |

   Write the full investigation to `/workspace/agent/memory/triage-<number>.md` — issue body, research findings, all candidate approaches with their tradeoffs, the recommended path, file:line pointers, repro. The fixer reads this; do not skip.

   ```bash
   cat > /workspace/agent/memory/triage-<number>.md << 'EOF'
   # Triage: shader-slang/slang#<number> — <title>
   Date: <ISO> | Category | Severity | Priority | Component

   ## What's broken / being requested
   ## Repro
   ## Codebase digest (file:line pointers)
   ## Candidate approaches
     ### Approach A: <name>
       - Where: <file:line>
       - Behaviour delta: ...
       - Tradeoffs: ...
       - Risk: ...
     ### Approach B: ...
   ## Recommended path
   ## Sources (DeepWiki Q&A summaries, related issues, PRs)
   EOF
   ```

7. **Report up to parent** {#report} — Send the [Triage] 5-bullet *and* attach the memo file. Bullets are the rollup; the memo is the briefing.

   ```
   send_message(to="parent", text="[Triage] shader-slang/slang#<number>: <title>\n\n• Classification: <cat> / <sev> / <comp> / <pri>\n• Summary: <one-line of the bug>\n• Solution space: <N> candidate approaches in memo (recommended: <name>)\n• Files: <top 3 paths the fix will touch>\n• Routing: forwarding to slang-fixer with full briefing")
   send_file(to="parent", path="/workspace/agent/memory/triage-<number>.md")
   ```

8. **Forward to slang-fixer — always** {#forward} — Hand off the rich briefing. **Do not gate on "if actionable"; do not drop the chain at triage.** The fixer decides whether and how to fix.

   ```
   send_message(to="slang-fixer", text="[Triage handoff] shader-slang/slang#<number>: <title>\n\nPriority: <pri>\nComponent: <comp>\nNot-compiler-code: <yes/no — if yes, where (CI/docs/build/etc.)>\n\n## Summary\n<what's broken / being requested>\n\n## Repro\n<exact steps + expected vs actual>\n\n## Candidate approaches\n1. <name> — <file:line> — <one-line tradeoff>\n2. <name> — ...\n3. <name> — ...\nRecommended: <which> because <why>\n\n## Files in scope\n<paths>\n\n## Risks / open questions\n<bullets>\n\nFull notes: /workspace/agent/memory/triage-<number>.md")
   send_file(to="slang-fixer", path="/workspace/agent/memory/triage-<number>.md")
   ```

   For *not-compiler-code* issues (CI yml, docs, build scripts): the fixer may bounce back — that's fine. Forward anyway and let the parent escalate; you do not own the routing decision.

9. **Wait for fixer's [Fix Report]** {#wait} — The fixer → reviewer → fixer chain takes 30-60 min. **The triage chain is NOT closed until you forward the resolution upstream.** While waiting:
   - Substantive inbound (fix-report, blocker, abort) → respond.
   - Status echoes ("still working", emoji, acks) → emit nothing.
   - Don't poll. Don't re-dispatch. The fixer reports back when it has signal.

10. **Forward resolution upstream** {#forward-up} — When `[Fix Report]` lands, compile the [Triage Resolution] 5-bullet:

    ```
    send_message(to="parent", in_reply_to=<id-of-fix-report>, text="[Triage Resolution] shader-slang/slang#<number>: <title>\n\n• Outcome: <fixed / partial / blocked / abandoned>\n• Draft PR: <url-or-'patch only, no PR'>\n• Review: <APPROVE / REQUEST_CHANGES / N findings — top concern>\n• Tests: <repro PASS/FAIL>; broader suite <result>\n• Next human action: <merge draft / address review / coordinate / close as wontfix>")
    ```

    For partial/blocked outcomes, still forward — substitute `blocked: <reason>` in the outcome bullet. Per `### Chain communication` in your spine: close every chain explicitly.

## Batch mode

Triaging multiple issues: process ONE at a time (Steps 1–8 fully before next). Multi-issue rollup goes to parent only, not to peer triagers.
