---
name: slang-triage-issue
license: MIT
type: workflow
description: 'Specialist triage of a Slang GitHub issue: research, map the solution space, hand a briefing to slang-fixer, then forward the resolution upstream.'
extends: triage-issue
requires: [issues.read, code.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: [slang-plan]
overrides:
  read: |
    **Read the issue** {#read} — `gh issue view <number> -R shader-slang/slang --comments`. Extract: what's broken/requested, error + repro, Slang versions/targets (HLSL, GLSL, SPIR-V, Metal, WGSL, CUDA), affected component, other-user confirmations.
  research: |
    **Research — three pillars in parallel** {#research} — Fan out via subagents; cost is your context, not wall clock.

    **Local code (PRIMARY).** `Agent` subagents read the mounted checkout — never read large files inline. One per _concern_, not per file; 2-3 in parallel for unrelated areas. Component paths: `slang-emit-*.cpp` (emitters), `slang-ir-*.cpp` (IR passes), `slang-check-*.cpp` (semantic).

    ```
    Agent(prompt="Read the local slang checkout for <area>. Find: entry point of <flow>, IR/AST nodes involved, where <X> is handled vs unhandled, covering tests. Return 10-line digest with file:line pointers and the gap explaining the issue.")
    ```

    **DeepWiki (PRIMARY — ≥2 questions):** architecture/flow/limitations only, not "what does file X say".

    ```
    mcp__deepwiki__ask_question("shader-slang/slang", "<focused question>")
    ```

    **`gh` CLI (BACKUP — duplicates, cross-repo):** only for what local + DeepWiki can't give. Slang has many tracking issues; check duplicates carefully.

    ```
    gh issue list -R shader-slang/slang --search "<keywords>" --state all --limit 10
    ```

    **[MUST] Tool parallelism rule.** Fire 2-3 `Agent` subagents at once for unrelated areas. **Do NOT** group a direct `mcp__deepwiki__ask_question` with a direct `Bash(gh ...)` in the same turn — if either errors, the harness cancels the sibling and you lose the result. Run direct `deepwiki` and `gh` in separate turns, or wrap each in its own subagent.
  classify: |
    **Classify + persist** {#classify} —

    | Field     | Options                                                                                                           |
    | --------- | ----------------------------------------------------------------------------------------------------------------- |
    | Category  | bug / feature-request / regression / enhancement / question / documentation                                       |
    | Severity  | critical / high / medium / low                                                                                    |
    | Component | frontend / IR / target-emit (HLSL/GLSL/SPIR-V/Metal/WGSL/CUDA) / autodiff / modules / language-server / CI / docs |
    | Priority  | P0 ship-stopper / P1 regression / P2 normal / P3 nice-to-have                                                     |
    | Duplicate | link or `no`                                                                                                      |

    Compose the memo at `/workspace/agent/memory/triage-<number>.md` via heredoc (not the `Write` tool — the file is new and `Write` requires Read-first). The fixer reads this; don't skip.

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
---
