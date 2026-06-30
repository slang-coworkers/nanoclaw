---
name: slang-plan
license: MIT
type: workflow
description: 'Plan, investigate, review, or research Slang compiler tasks. Augments the base plan workflow with parallel local + upstream research when the repo is mounted.'
extends: plan
requires: [issues.read, code.read, doc.read]
uses:
  skills: [slang-code-reader, slang-github]
  workflows: []
overrides:
  research: |
    **Research** — Gather evidence from local source and upstream docs.

    Check whether the Slang repo is available locally:

    ```bash
    [ -d /workspace/agent/slang ] && ls /workspace/agent/slang | head -5
    ```

    **If `/workspace/agent/slang/` exists and is non-empty** — run two paths in parallel:

    Path A (local code) — spawn an `Agent` subagent:
    > Explore `/workspace/agent/slang/` for code relevant to <target>. Use Grep, Glob, Read. Focus on: compiler pipeline stages, source in `source/slang/`, IR passes, emitters, tests under `tests/`, recent git log. Produce a concise findings note.

    Path B (upstream docs) — query DeepWiki in parallel:
    ```
    mcp__deepwiki__ask_question("shader-slang/slang", "<question about target derived from the task>")
    ```
    Ask at least one focused question about the relevant compiler stage/subsystem; a second if the first raises a follow-up.

    Merge both paths' findings before Synthesize.

    **If absent or empty** — invoke `/slang-build` to clone + set up first, then proceed single-path: local code exploration (grep, read, git log) inside the clone + DeepWiki queries (as Path B) to cross-reference docs.

    Stay read-only throughout. Do not modify files.
---
