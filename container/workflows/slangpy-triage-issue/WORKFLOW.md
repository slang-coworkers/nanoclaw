---
name: slangpy-triage-issue
license: MIT
type: workflow
description: "Specialist triage of a SlangPy GitHub issue (shader-slang/slangpy): research deep, map the solution space, hand off a rich briefing to slangpy-fixer (or escalate to slang-fixer for upstream compiler bugs), then forward fixer's resolution back upstream."
requires: [issues.read, code.read]
uses:
  skills: [slangpy-code-reader, slangpy-github]
  workflows: [slangpy-plan]
---

# /slangpy-triage-issue — Specialist triage

You are the **slangpy specialist** and the first line of engineering on the issue. Investigate. Hand the fixer a briefing they can act on in under a minute: 2-3 approaches with file:line pointers, tradeoffs, recommended path.

Read-only on GitHub: never post, label, or modify anything. Output flows via `send_message`.

## Operating posture

- **Three research pillars: DeepWiki, local code, `gh` CLI.** DeepWiki for architecture Q&A. Subagents read the locally-mounted repo for code (the local checkout IS authoritative — don't fetch what's already there). `gh` for GitHub queries (duplicates, prior PRs, cross-repo). Use `/slangpy-plan` for non-trivial solution-space work.
- **Always forward to slangpy-fixer.** No "if actionable" gate. Upstream-compiler bug? Forward with `escalate-to-slang: <why>` and let the fixer/orchestrator route — you don't own the routing decision.
- **Output the solution space.** Handoff with one approach is half a handoff. 2-3 candidates with tradeoffs lets the fixer pick fast and pivot if the first hits a wall.

## Steps

1. **Read the issue** {#read} — `gh issue view <number> -R shader-slang/slangpy --comments`. Extract: what's broken or being requested, error messages + repro, SlangPy version + Python version + GPU backend (CUDA / Vulkan / D3D12 / Metal), affected layer (Python `slangpy/` / C++ binding `src/slangpy_ext/` / SGL `src/sgl/` / native torch `src/slangpy_torch/`), confirmations from other users.

   Two upstream concern areas have dedicated instruction files — check them when relevant:
   - **Torch issues** — `.github/instructions/torchintegration.instructions.md` (read via `slang-mcp` if needed)
   - **Benchmark issues** — `.github/instructions/benchmarks.instructions.md`

2. **Recall** {#recall} — Spawn an `Agent` subagent to scan prior triage learnings before researching:

   ```
   Agent(prompt="Scan /workspace/shared/learnings/INDEX.md for entries relevant to slangpy issue #<number>'s topic, prior triage patterns, or duplicate-resolution heuristics. Read at most 3 individual learning files if INDEX entries look directly applicable. Return: ≤5 bullets — title, 1-line summary, file path. If no hits, return 'no prior hits' and stop.")
   ```

3. **Research — three pillars in parallel** {#research} — Fan out via subagents. Cost is your context, not wall clock.

   **Local code (PRIMARY).** The slangpy checkout is mounted locally. Spawn `Agent` subagents to read it — never read large files inline; the subagent returns a digest, you keep context for the solution-space step.

   ```
   Agent(prompt="Read the local slangpy checkout for <area>. Find: (1) entry point of <flow>, (2) type/marshall path, (3) where <X> is handled vs unhandled, (4) tests covering the area. Return 10-line digest with file:line pointers and the gap that explains the issue. Don't quote large blocks.")
   ```

   2-3 subagents in parallel for unrelated areas. One per *concern*, not per file.

   Layer paths to target:
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
   Architecture / flow / limitations questions only — not "what does file X say" (that's local code's job). Examples: *"How does the functional API handle <type> in kernel generation?"*, *"What is the marshalling path for `<python type>` to Slang `<param type>`?"*, *"What are the limitations of <feature> on Metal / Vulkan / D3D12?"*.

   **`gh` CLI (BACKUP — duplicates and cross-repo):**
   ```
   gh issue list -R shader-slang/slangpy --search "<keywords>" --state all --limit 10
   gh search issues "<keywords>" --owner shader-slang --limit 10
   gh pr list -R shader-slang/slangpy --search "<keywords>" --state all --limit 5
   ```
   Use `gh` only for what local + DeepWiki can't give: searching the issue tracker for duplicates, prior fixes, related PRs.

   **[MUST] Tool parallelism rule.** Subagents are isolated and safe to run in parallel — fire 2-3 `Agent` subagents at once for unrelated local-code areas. **Do NOT** group a direct `mcp__deepwiki__ask_question` call together with a direct `Bash(gh ...)` call in the same assistant turn — if either errors (gh returns non-zero on partial output, deepwiki times out), the harness cancels the parallel sibling and you lose the result. Run direct `deepwiki` and `gh` queries in **separate** turns, or wrap each in its own `Agent` subagent for failure isolation.

   Many SlangPy bugs trace to the upstream Slang compiler. Compiler-side smell (codegen, target-specific failure)? Annotate *"escalate-to-slang"* in the handoff — still forward to slangpy-fixer; chain decides escalation, not the triager.

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

   Compose the full investigation memo at `/workspace/agent/memory/triage-<number>.md` using the heredoc block below (do **not** use the `Write` tool — the file is new and `Write` requires Read-first which fails or stales). Memo includes: issue body, research findings, all candidate approaches with tradeoffs, the recommended path, file:line pointers, repro. The fixer reads this; do not skip.

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
   send_message(to="parent", text="[Triage] shader-slang/slangpy#<number>: <title>\n\n- **Classification:** <cat> / <sev> / <layer> / <backend> / <pri>\n- **Summary:** <one-line of the bug>\n- **Solution space:** <N> candidate approaches in memo (recommended: <name>)\n- **Files:** <top 3 paths the fix will touch>\n- **Routing:** forwarding to slangpy-fixer with full briefing<; escalate-to-slang flagged in memo>")
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
    send_message(to="parent", in_reply_to=<id-of-fix-report>, text="[Triage Resolution] shader-slang/slangpy#<number>: <title>\n\n- **Outcome:** <fixed / partial / blocked / abandoned>\n- **Draft PR:** <url-or-'patch only, no PR'>\n- **Review:** <APPROVE / REQUEST_CHANGES / N findings — top concern> (Devin: <verdict or skipped>)\n- **Tests:** <repro PASS/FAIL>; broader suite <result>\n- **Next human action:** <merge draft / address review / coordinate / close as wontfix>")
    ```

    For partial/blocked outcomes, still forward — substitute `blocked: <reason>` in the outcome bullet. Per `### Chain communication` in your spine: close every chain explicitly.

## Batch mode

Triaging multiple issues: process ONE at a time (Steps 1–8 fully before next). Multi-issue rollup goes to parent only, not to peer triagers.
