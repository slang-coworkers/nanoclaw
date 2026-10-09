---
name: slang-triage-issue
license: MIT
type: workflow
description: 'Specialist triage of a Slang GitHub issue: research, map the solution space, write the solution brief, hand it to slang-fixer when the issue is actionable or park it on the issue for maintainer direction, then forward the resolution upstream.'
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

    **Labels and Issue Type:** apply them per the labeling policy in your Additional Instructions when one exists (it names the labels, the Issue Type ids and who may set them); without such a policy, triage is read-only on labels.

    Compose the memo at `/workspace/agent/memory/triage-<number>.md` via heredoc (not the `Write` tool — the file is new and `Write` requires Read-first). The fixer reads this; its **Recommended path** section is the solution brief the fixer confirms into its plan, so it must name the approach, the files, the repro command and the acceptance criteria in at most 15 lines.

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
  forward: |
    **Forward or park** {#forward} — Decide from the brief, never by silence:

    | Situation | Action |
    | --- | --- |
    | Bug or regression with a reproducer, or a change a maintainer already asked for | Send `[Triage handoff]` to `{{vars.fixer}}` now with the brief (summary, repro, recommended approach + alternatives, files, acceptance criteria, risks) and `send_file` the memo. |
    | Feature request, design question, conflicting maintainer constraints, or no reproducer | Post the brief as the issue 5-bullet (next step) with the decision the maintainer must make, create one `ncl tasks create --process-after` re-check (never a recurrence), and forward to `{{vars.fixer}}` only when a maintainer replies with direction or the repro is confirmed. The chain's `next` names the decision owner while parked. |

    ```
    send_message(to="{{vars.fixer}}", text="[Triage handoff] {{vars.repo}}#<number>: <title>\nPriority: <pri> | Component: <comp>\nRecommended: <name> — <file:line> — <why>\nRepro: <command>\nAccept when: <criteria>; alternatives + risks in memo")
    send_file(to="{{vars.fixer}}", path="/workspace/agent/memory/triage-<number>.md")
    ```
