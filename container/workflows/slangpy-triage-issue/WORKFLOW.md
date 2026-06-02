---
name: slangpy-triage-issue
license: MIT
type: workflow
description: 'Specialist triage of a SlangPy GitHub issue: research, map the solution space, hand a briefing to slangpy-fixer (flag escalate-to-slang for compiler bugs), then forward the resolution upstream.'
requires: [issues.read, code.read]
uses:
  skills: [slangpy-code-reader, slangpy-github]
  workflows: [slangpy-plan]
---

# /slangpy-triage-issue — Specialist triage

You are the **slangpy specialist** and first line of engineering. Hand the fixer a briefing actionable in under a minute: 2-3 approaches with file:line pointers, tradeoffs, recommended path. Read-only on GitHub: never post/label/modify. Output flows via `send_message`.

Posture: three research pillars — DeepWiki (architecture), local code via subagents (mounted checkout IS authoritative, don't refetch), `gh` (duplicates, prior PRs). Use `/slangpy-plan` for non-trivial solution-space work. Always forward to slangpy-fixer (no "if actionable" gate); the chain routes escalation, not you.

## Steps

1. **Read the issue** {#read} — `gh issue view <number> -R shader-slang/slangpy --comments`. Extract: what's broken/requested, error + repro, SlangPy + Python version + GPU backend (CUDA / Vulkan / D3D12 / Metal), affected layer (Python `slangpy/` / C++ `src/slangpy_ext/` / SGL `src/sgl/` / native torch `src/slangpy_torch/`), other-user confirmations. Dedicated instruction files (read via `slang-mcp`): Torch — `.github/instructions/torchintegration.instructions.md`; Benchmarks — `.github/instructions/benchmarks.instructions.md`.

2. **Recall** {#recall} — Spawn an `Agent` subagent to scan prior triage learnings first:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slangpy issue #<number>'s topic, prior triage patterns, or duplicate-resolution heuristics. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Research — three pillars in parallel** {#research} — Fan out via subagents (cost is context, not wall clock).

   **Local code (PRIMARY).** Spawn 2-3 `Agent` subagents for unrelated areas (one per _concern_, not per file) — never read large files inline; the subagent returns a digest.

   ```
   Agent(prompt="Read the local slangpy checkout for <area>. Find: (1) entry point of <flow>, (2) type/marshall path, (3) where <X> is handled vs unhandled, (4) tests covering the area. Return 10-line digest with file:line pointers and the gap that explains the issue. Don't quote large blocks.")
   ```

   Layer paths to target:
   - Functional API → `slangpy/core/{function,calldata,callsignature,module}.py`
   - Type marshalling → `slangpy/bindings/{boundvariable,marshall,typeregistry}.py`, `slangpy/builtin/*.py`
   - Type resolution → `slangpy/reflection/typeresolution.py`
   - C++ bindings → `src/slangpy_ext/utils/{slangpyfunction,slangpy}.cpp`
   - GPU layer → `src/sgl/`
   - Torch integration → `slangpy/torchintegration/`, `src/slangpy_torch/`

   **DeepWiki (PRIMARY — ≥2 questions):** architecture / flow / limitations only, not "what does file X say".

   ```
   mcp__deepwiki__ask_question("shader-slang/slangpy", "<focused question>")
   ```

   E.g. _"How does the functional API handle <type> in kernel generation?"_, _"Limitations of <feature> on Metal / Vulkan / D3D12?"_.

   **`gh` CLI (BACKUP)** — only for what local + DeepWiki can't give: duplicates, prior fixes, related PRs. (`gh search issues --owner shader-slang` and `gh pr list -R shader-slang/slangpy` similarly.)

   ```
   gh issue list -R shader-slang/slangpy --search "<keywords>" --state all --limit 10
   ```

   **[MUST] Tool parallelism rule.** Fire 2-3 `Agent` subagents at once for unrelated local-code areas (isolated, safe). **Do NOT** group a direct `mcp__deepwiki__ask_question` with a direct `Bash(gh ...)` in the same turn — if either errors the harness cancels the sibling and you lose the result. Run direct `deepwiki` and `gh` queries in **separate** turns, or wrap each in its own `Agent` subagent.

   Compiler-side smell (codegen, target-specific failure)? Annotate _"escalate-to-slang"_ in the handoff — still forward to slangpy-fixer; the chain decides escalation.

4. **Map the solution space** {#solution-space} — Enumerate, don't pick. Use `/slangpy-plan` if non-trivial. Per candidate: **name** (one phrase) · **where it lives** (file:line) · **behaviour delta** · **tradeoffs** (perf / correctness / maintenance / blast radius / cross-backend) · **risk** (one line). Two minimum, three when they exist. If only one is viable, say so with the constraint that ruled others out — that's load-bearing.

5. **Pick a recommended path** {#recommend} — A starting point the fixer can override, not a verdict. Recommend the _fastest correct fix that doesn't regress adjacent surfaces or paper over an upstream slang bug_. Flag explicitly when uncertain or when slang-fixer escalation is right.

6. **Classify + persist** {#classify} —

   | Field           | Options                                                                                                                    |
   | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
   | Category        | bug / feature-request / regression / enhancement / question / documentation                                                |
   | Severity        | critical / high / medium / low                                                                                             |
   | Layer           | python-api / nanobind-bindings / SGL / functional-API / torch-integration / autograd / build-system / CI / docs / examples |
   | Backend         | CUDA / Vulkan / D3D12 / Metal / cross-backend / N/A                                                                        |
   | Priority        | P0 ship-stopper / P1 regression / P2 normal / P3 nice-to-have                                                              |
   | Duplicate       | link or `no`                                                                                                               |
   | Upstream-Slang? | yes (recommend escalation) / no                                                                                            |

   Write the investigation memo to `/workspace/agent/memory/triage-<number>.md` via the heredoc below (not the `Write` tool — Write requires Read-first which fails on a new file). The fixer reads this; do not skip.

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

7. **Report up to parent** {#report} — Send the [Triage] 5-bullet _and_ attach the memo (bullets = rollup, memo = briefing).

   ```
   send_message(to="parent", text="[Triage] shader-slang/slangpy#<number>: <title>\n\n- **Classification:** <cat> / <sev> / <layer> / <backend> / <pri>\n- **Summary:** <one-line of the bug>\n- **Solution space:** <N> candidate approaches in memo (recommended: <name>)\n- **Files:** <top 3 paths the fix will touch>\n- **Routing:** forwarding to slangpy-fixer with full briefing<; escalate-to-slang flagged in memo>")
   send_file(to="parent", path="/workspace/agent/memory/triage-<number>.md")
   ```

8. **Forward to slangpy-fixer — always** {#forward} — Hand off the briefing; never gate on "if actionable". The fixer decides whether and how to fix.

   ```
   send_message(to="slangpy-fixer", text="[Triage handoff] shader-slang/slangpy#<number>: <title>\n\nPriority: <pri>\nLayer: <layer>\nBackend: <backend>\nUpstream-Slang: <yes/no — escalate-to-slang: <why> when yes>\n\n## Summary\n<what's broken / being requested>\n\n## Repro\n<exact steps + expected vs actual>\n\n## Candidate approaches\n1. <name> — <file:line> — <one-line tradeoff>\n2. <name> — ...\n3. <name> — ...\nRecommended: <which> because <why>\n\n## Files in scope\n<paths>\n\n## Risks / open questions\n<bullets>\n\nFull notes: /workspace/agent/memory/triage-<number>.md")
   send_file(to="slangpy-fixer", path="/workspace/agent/memory/triage-<number>.md")
   ```

   Upstream-Slang issues: forward anyway with `escalate-to-slang: <why>`. The fixer may bounce back or hand off — that's the chain's call.

9. **Wait for fixer's [Fix Report]** {#wait} — The fixer → reviewer → fixer chain takes 30-60 min. **The chain is NOT closed until you forward the resolution upstream.** While waiting: substantive inbound (fix-report, blocker, abort) → respond; status echoes (acks, emoji) → emit nothing. Don't poll or re-dispatch.

10. **Forward resolution upstream** {#forward-up} — When `[Fix Report]` lands, compile the [Triage Resolution] 5-bullet:

    ```
    send_message(to="parent", in_reply_to=<id-of-fix-report>, text="[Triage Resolution] shader-slang/slangpy#<number>: <title>\n\n- **Outcome:** <fixed / partial / blocked / abandoned>\n- **Draft PR:** <url-or-'patch only, no PR'>\n- **Review:** <APPROVE / REQUEST_CHANGES / N findings — top concern> (Devin: <verdict or skipped>)\n- **Tests:** <repro PASS/FAIL>; broader suite <result>\n- **Next human action:** <merge draft / address review / coordinate / close as wontfix>")
    ```

    For partial/blocked outcomes, still forward — substitute `blocked: <reason>`. Per `### Chain communication` in your spine: close every chain explicitly.

## Batch mode

Multiple issues: process ONE at a time (Steps 1–8 fully before next). Multi-issue rollup goes to parent only, not to peer triagers.
