---
name: slangpy-triage-issue
license: MIT
type: workflow
description: 'Specialist triage of a SlangPy GitHub issue: research, map the solution space, hand a briefing to slangpy-fixer (flag escalate-to-slang for compiler bugs), then forward the resolution upstream.'
extends: triage-issue
requires: [issues.read, code.read]
uses:
  skills: [slangpy-code-reader, slangpy-github]
  workflows: [slangpy-plan]
overrides:
  read: |
    **Read the issue** {#read} — `gh issue view <number> -R shader-slang/slangpy --comments`. Extract: what's broken/requested, error + repro, SlangPy + Python version + GPU backend (CUDA / Vulkan / D3D12 / Metal), affected layer (Python `slangpy/` / C++ `src/slangpy_ext/` / SGL `src/sgl/` / native torch `src/slangpy_torch/`), other-user confirmations. Dedicated instruction files (read via `slang-mcp`): Torch — `.github/instructions/torchintegration.instructions.md`; Benchmarks — `.github/instructions/benchmarks.instructions.md`.
  research: |
    **Research — three pillars in parallel** {#research} — Fan out via subagents (cost is context, not wall clock).

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

    **[MUST] Tool parallelism rule.** Fire 2-3 `Agent` subagents at once for unrelated areas. **Do NOT** group a direct `mcp__deepwiki__ask_question` with a direct `Bash(gh ...)` in the same turn — if either errors, the harness cancels the sibling and you lose the result. Run direct `deepwiki` and `gh` in separate turns, or wrap each in its own subagent.
  classify: |
    **Classify + persist** {#classify} —

    | Field           | Options                                                                                                                    |
    | --------------- | -------------------------------------------------------------------------------------------------------------------------- |
    | Category        | bug / feature-request / regression / enhancement / question / documentation                                                |
    | Severity        | critical / high / medium / low                                                                                             |
    | Layer           | python-api / nanobind-bindings / SGL / functional-API / torch-integration / autograd / build-system / CI / docs / examples |
    | Backend         | CUDA / Vulkan / D3D12 / Metal / cross-backend / N/A                                                                        |
    | Priority        | P0 ship-stopper / P1 regression / P2 normal / P3 nice-to-have                                                              |
    | Duplicate       | link or `no`                                                                                                               |
    | Upstream-Slang? | yes (recommend escalation) / no                                                                                            |

    Write the investigation memo to `/workspace/agent/memory/triage-<number>.md` via the heredoc below (not the `Write` tool — Write requires Read-first which fails on a new file). The fixer reads this; do not skip. Upstream-Slang issues (compiler-side codegen / target-specific failures): set Upstream-Slang=yes and note `escalate-to-slang` in the memo — still forward to slangpy-fixer; the chain decides escalation.

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
---
