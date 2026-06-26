---
name: nanoclaw-plan
license: MIT
type: workflow
description: 'Plan, investigate, review, or research NanoClaw tasks. Augments the base plan workflow with parallel local + upstream research when the repo is mounted.'
extends: plan
requires: [issues.read, code.read, doc.read]
uses:
  skills: [nanoclaw-code-reader, nanoclaw-github]
  workflows: []
overrides:
  research: |
    **Research** — Gather evidence from local source and upstream docs.

    Check whether the repo is available locally:

    ```bash
    [ -d /workspace/agent/nanoclaw ] && ls /workspace/agent/nanoclaw | head -5
    ```

    **If `/workspace/agent/nanoclaw/` exists and is non-empty** — run two paths in parallel:

    Path A (local code) — spawn an `Agent` subagent:
    > Explore `/workspace/agent/nanoclaw/` to understand the code relevant to <target>. Use Grep, Glob, Read. Focus on: `src/` host modules, `container/` agent-runner and skills, `src/claude-composer/` spine system, relevant tests, recent git log. Produce a concise findings note.

    Path B (upstream docs) — query DeepWiki in parallel:
    ```
    mcp__deepwiki__ask_question("qwibitai/nanoclaw", "<question about target derived from the task>")
    ```
    Ask at least one focused question about the relevant subsystem; ask a second if the first answer raises a follow-up.

    Merge both paths' findings before Synthesize.

    **If absent or empty** — invoke `/nanoclaw-build` to clone and set up the repo first, then proceed with a single path: local exploration (grep, read, git log) inside the clone, plus DeepWiki queries (as Path B) to cross-reference.

    Stay read-only throughout. Do not modify files.
---
