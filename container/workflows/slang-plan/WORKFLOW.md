---
name: slang-plan
license: MIT
type: workflow
description: "Plan, investigate, review, or research Slang compiler tasks. Augments the base plan workflow with parallel local + upstream research when the repo is mounted."
extends: plan
requires: [issues.read, code.read, doc.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
overrides:
  research: |
    **Research** — Gather evidence from local source and upstream docs.

    First, check whether the Slang repo is available locally:

    ```bash
    [ -d /workspace/agent/slang ] && ls /workspace/agent/slang | head -5
    ```

    **If `/workspace/agent/slang/` exists and is non-empty** — run these two research paths in parallel:

    Path A (local code exploration) — spawn an `Agent` subagent:
    > Explore `/workspace/agent/slang/` to understand the code relevant to <target>. Use Grep, Glob, and Read. Focus on: compiler pipeline stages, relevant source files in `source/slang/`, IR passes, emitters, test files under `tests/`, recent git log. Produce a concise findings note.

    Path B (upstream docs) — query DeepWiki in parallel with Path A:
    ```
    mcp__deepwiki__ask_question("shader-slang/slang", "<question about target derived from the task>")
    ```
    Ask at least one focused question about the relevant compiler stage or subsystem. Ask a second question if the first answer raises a follow-up.

    Merge the findings from both paths before proceeding to Synthesize.

    **If `/workspace/agent/slang/` is absent or empty** — invoke `/slang-build` to clone and set up the repo first, then proceed with a single research path:
    - Local code exploration (grep, read files, git log) inside the cloned repo
    - DeepWiki queries (same as Path B above) to cross-reference upstream docs

    Stay read-only throughout. Do not modify files.
---
