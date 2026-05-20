---
name: slangpy-triage-issue
license: MIT
type: workflow
description: "Principal-engineer triage of a SlangPy GitHub issue (shader-slang/slangpy): research deep, map the solution space, hand off a rich briefing to slangpy-fixer (or escalate to slang-fixer for upstream compiler bugs), then forward fixer's resolution back upstream."
requires: [issues.read, code.read]
uses:
  skills: [slangpy-code-reader, slangpy-github]
  workflows: [slangpy-plan]
---

# /slangpy-triage-issue — Principal-engineer triage

You are the **first line of engineering** on this issue. Not a classifier — an investigator. Your job is to make the fixer's job easy: come back with the bug understood from the codebase up, two or three concrete approaches with tradeoffs, and a recommended path. The fixer should be able to start coding within a minute of reading your handoff.

Read-only on GitHub. **Never** post comments, create labels, or modify anything on github.com. All output flows back via `send_message`.

## Operating posture

- **Use all the compute.** The plan = **local codebase + DeepWiki**. Subagents read the local repo in parallel; DeepWiki answers the architectural questions. `/slangpy-plan` for non-trivial solution-space work. Lean on slang-mcp only for what local can't give you (duplicate issue search) — not for fetching files.
- **Always forward.** There is no "this is out of scope, I won't forward" branch. If the bug is upstream-compiler (codegen, target-specific failure), forward to `slangpy-fixer` anyway with `escalate-to-slang: <why>` in the briefing — the fixer or orchestrator escalates to the slang chain. Don't drop the chain at triage.
- **Solution space, not just diagnosis.** A handoff with one approach is half a handoff. Two-three candidate approaches with tradeoffs lets the fixer pick fast and try multiples if the first hits a wall.

## Steps

1. **Read the issue** {#read} — `gh issue view <number> -R shader-slang/slangpy --comments`. Extract: what's broken or being requested, error messages + repro, SlangPy version + Python version + GPU backend (CUDA / Vulkan / D3D12 / Metal), affected layer (Python `slangpy/` / C++ binding `src/slangpy_ext/` / SGL `src/sgl/` / native torch `src/slangpy_torch/`), confirmations from other users.

   Two upstream concern areas have dedicated instruction files — check them when relevant:
   - **Torch issues** — `.github/instructions/torchintegration.instructions.md` (read via `slang-mcp` if needed)
   - **Benchmark issues** — `.github/instructions/benchmarks.instructions.md`

2. **Recall** {#recall} — Spawn an `Agent` subagent to scan prior triage learnings before researching:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slangpy issue #<number>'s topic, prior triage patterns, or duplicate-resolution heuristics. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Research — fan out, don't sequence** {#research} — Two pillars: **local codebase exploration** and **DeepWiki**. Run them in parallel via subagents. The cost is your context, not wall clock.

   **Local codebase exploration (PRIMARY).** The slangpy repo is mounted at `/workspace/project/slangpy` (or your project's local path — check your skills). Spawn `Agent` subagents to read the actual code — *don't* read large files inline. The subagent returns a digest; you keep your context for the solution-space step.

   ```
   Agent(prompt="Explore the local slangpy checkout at <path> for <area>. Find: (1) the entry point of <flow>, (2) the type/marshall path involved, (3) where <X> is currently handled vs unhandled, (4) tests that cover the area. Return a 10-line digest with file:line pointers and the gap that explains the issue. Don't quote large blocks — point at lines.")
   ```

   Two-three subagents in parallel for unrelated areas. One per file is too narrow; one per *concern* is right. The local checkout is authoritative — read it, don't fetch it.

   For source, target the layer named in the issue:
   - Functional API → `slangpy/core/{function,calldata,callsignature,module}.py`
   - Type marshalling → `slangpy/bindings/{boundvariable,marshall,typeregistry}.py`, `slangpy/builtin/*.py`
   - Type resolution → `slangpy/reflection/typeresolution.py`
   - C++ bindings → `src/slangpy_ext/utils/{slangpyfunction,slangpy}.cpp`
   - GPU layer → `src/sgl/`
   - Torch integration → `slangpy/torchintegration/`, `src/slangpy_torch/`

   **DeepWiki (PRIMARY — ≥2 questions):**
   ```
   mcp__deepwiki__ask_question("shader-slang/slangpy", "<focused question>")
   ```
   Good questions: *"How does the functional API handle <type> in kernel generation?"*, *"What is the marshalling path for `<python type>` to Slang `<param type>`?"*, *"How does the torch integration synchronize CUDA streams?"*, *"What are the limitations of <feature> on the Metal / Vulkan / D3D12 backend?"*.

   **slang-mcp (only when local can't help):** the *one* thing slang-mcp does that local can't is search GitHub issues for duplicates / prior fixes:
   ```
   mcp__slang-mcp__github_search_issues(query="<keywords>", repo="shader-slang/slangpy")
   ```
   Don't use `github_get_file_contents` — read the local checkout instead, it's the same bytes.

   Many SlangPy bugs trace back to the upstream Slang compiler. If the issue smells compiler-side (codegen of generated kernel, target-specific failure), call out *"escalate-to-slang"* in your handoff — but still forward to slangpy-fixer first; the chain decides escalation, not the triager.

4. **Map the solution space** {#solution-space} — Don't pick yet. Enumerate. Use `/slangpy-plan` if it's non-trivial.

   For each candidate approach, write:
   - **Approach name** (one phrase: *"add marshall override"*, *"build-time validation"*, *"escalate to slang upstream"*)
   - **Where it lives** (file:line — the spot that changes)
   - **Behaviour delta** (what the user sees)
   - **Tradeoffs** (perf / correctness / maintenance / blast radius / cross-backend impact)
   - **Risk** (one line: what could go wrong)

   Two minimum, three when they exist. If only one approach is viable, say so explicitly with the constraint that ruled others out — that's a load-bearing finding.

5. **Pick a recommended path** {#recommend} — Not a verdict; a starting point. The fixer can override. Recommend by: *fastest correct fix that doesn't regress adjacent surfaces (and doesn't paper over an upstream slang bug)*. Note explicitly when a recommendation is uncertain or when escalation to slang-fixer is the right move.

6. **Classify + persist** {#classify} —

   | Field | Options |
   |---|---|
   | Category | bug / feature-request / regression / enhancement / question / documentation |
   | Severity | critical / high / medium / low |
   | Layer | python-api / nanobind-bindings / SGL / functional-API / torch-integration / autograd / build-system / CI / docs / examples |
   | Backend | CUDA / Vulkan / D3D12 / Metal / cross-backend / N/A |
   | Priority | P0 ship-stopper / P1 regression / P2 normal / P3 nice-to-have |
   | Duplicate | link or `no` |
   | Upstream-Slang? | yes (recommend escalation) / no |

   Write the full investigation to `/workspace/agent/memory/triage-<number>.md` — issue body, research findings, all candidate approaches with their tradeoffs, the recommended path, file:line pointers, repro. The fixer reads this; do not skip.

   ```bash
   cat > /workspace/agent/memory/triage-<number>.md << 'EOF'
   # Triage: shader-slang/slangpy#<number> — <title>
   Date: <ISO> | Category | Severity | Priority | Layer | Backend | Upstream-Slang

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
   send_message(to="parent", text="[Triage] shader-slang/slangpy#<number>: <title>\n\n• Classification: <cat> / <sev> / <layer> / <backend> / <pri>\n• Summary: <one-line of the bug>\n• Solution space: <N> candidate approaches in memo (recommended: <name>)\n• Files: <top 3 paths the fix will touch>\n• Routing: forwarding to slangpy-fixer with full briefing<; escalate-to-slang flagged in memo>")
   send_file(to="parent", path="/workspace/agent/memory/triage-<number>.md")
   ```

8. **Forward to slangpy-fixer — always** {#forward} — Hand off the rich briefing. **Do not gate on "if actionable"; do not drop the chain at triage.** The fixer decides whether and how to fix.

   ```
   send_message(to="slangpy-fixer", text="[Triage handoff] shader-slang/slangpy#<number>: <title>\n\nPriority: <pri>\nLayer: <layer>\nBackend: <backend>\nUpstream-Slang: <yes/no — escalate-to-slang: <why> when yes>\n\n## Summary\n<what's broken / being requested>\n\n## Repro\n<exact steps + expected vs actual>\n\n## Candidate approaches\n1. <name> — <file:line> — <one-line tradeoff>\n2. <name> — ...\n3. <name> — ...\nRecommended: <which> because <why>\n\n## Files in scope\n<paths>\n\n## Risks / open questions\n<bullets>\n\nFull notes: /workspace/agent/memory/triage-<number>.md")
   send_file(to="slangpy-fixer", path="/workspace/agent/memory/triage-<number>.md")
   ```

   For *upstream-Slang* issues: forward anyway with `escalate-to-slang: <why>` annotation. The fixer may bounce back or hand off — that's fine. Forward and let the chain escalate; you do not own the routing decision.

9. **Wait for fixer's [Fix Report]** {#wait} — The fixer → reviewer → fixer chain takes 30-60 min. **The triage chain is NOT closed until you forward the resolution upstream.** While waiting:
   - Substantive inbound (fix-report, blocker, abort) → respond.
   - Status echoes ("still working", emoji, acks) → emit nothing.
   - Don't poll. Don't re-dispatch. The fixer reports back when it has signal.

10. **Forward resolution upstream** {#forward-up} — When `[Fix Report]` lands, compile the [Triage Resolution] 5-bullet:

    ```
    send_message(to="parent", in_reply_to=<id-of-fix-report>, text="[Triage Resolution] shader-slang/slangpy#<number>: <title>\n\n• Outcome: <fixed / partial / blocked / abandoned>\n• Draft PR: <url-or-'patch only, no PR'>\n• Review: <APPROVE / REQUEST_CHANGES / N findings — top concern> (Devin: <verdict or skipped>)\n• Tests: <repro PASS/FAIL>; broader suite <result>\n• Next human action: <merge draft / address review / coordinate / close as wontfix>")
    ```

    For partial/blocked outcomes, still forward — substitute `blocked: <reason>` in the outcome bullet. Per `### Chain communication` in your spine: close every chain explicitly.

## Batch mode

Triaging multiple issues: process ONE at a time (Steps 1–8 fully before next). Multi-issue rollup goes to parent only, not to peer triagers.
