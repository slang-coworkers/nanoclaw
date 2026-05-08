---
name: slangpy-plan
license: MIT
type: workflow
description: "Plan, investigate, review, or research SlangPy tasks. Augments the base plan workflow with parallel local + upstream research when the repo is mounted."
extends: plan
requires: [issues.read, code.read, doc.read]
uses:
  skills: [slangpy-code-reader, slangpy-github]
  workflows: []
overrides:
  research: |
    **Research** — Gather evidence from local source and upstream docs.

    First, check whether the SlangPy repo is available locally:

    ```bash
    [ -d /workspace/project ] && ls /workspace/project | head -5
    ```

    **If `/workspace/project/` exists and is non-empty** — run these two research paths in parallel:

    Path A (local code exploration) — spawn an `Agent` subagent:
    > Explore `/workspace/project/` to understand the code relevant to <target>. Use Grep, Glob, and Read. Focus on: structure, entry points, call paths, test files, recent git log. Produce a concise findings note.

    Path B (upstream docs) — query DeepWiki in parallel with Path A:
    ```
    mcp__deepwiki__ask_question("shader-slang/slangpy", "<question about target derived from the task>")
    ```
    Ask at least one focused question about architecture or the relevant subsystem. Ask a second question if the first answer raises a follow-up.

    Merge the findings from both paths before proceeding to Synthesize.

    **If `/workspace/project/` is absent or empty** — invoke `/slangpy-build` to clone and set up the repo first, then proceed with a single research path:
    - Local code exploration (grep, read files, git log) inside `/workspace/agent/slangpy/`
    - DeepWiki queries (same as Path B above) to cross-reference upstream docs

    Stay read-only throughout. Do not modify files.
---
