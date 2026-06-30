---
name: slangpy-plan
license: MIT
type: workflow
description: 'Plan, investigate, review, or research SlangPy tasks. Augments the base plan workflow with parallel local + upstream research when the repo is mounted.'
extends: plan
requires: [issues.read, code.read, doc.read]
uses:
  skills: [slangpy-code-reader, slangpy-github]
  workflows: []
overrides:
  research: |
    **Research** — Gather evidence from local source and upstream docs. Check whether the repo is local:

    ```bash
    [ -d /workspace/agent/slangpy ] && ls /workspace/agent/slangpy | head -5
    ```

    **If `/workspace/agent/slangpy/` exists and is non-empty** — run two paths in parallel:

    Path A (local code) — spawn an `Agent` subagent:
    > Explore `/workspace/agent/slangpy/` for code relevant to <target>. Use Grep, Glob, Read. Focus: structure, entry points, call paths, test files, recent git log. Return a concise findings note.

    Path B (upstream docs) — query DeepWiki in parallel:
    ```
    mcp__deepwiki__ask_question("shader-slang/slangpy", "<question about target derived from the task>")
    ```
    Ask ≥1 focused question on architecture or the relevant subsystem; add a second if the first raises a follow-up.

    Merge both paths before Synthesize.

    **If absent or empty** — invoke `/slangpy-build` to clone and set up the repo first, then run a single path:
    - Local code exploration (grep, read, git log) inside `/workspace/agent/slangpy/`
    - DeepWiki queries (as Path B) to cross-reference upstream docs

    Stay read-only throughout. Do not modify files.
---
