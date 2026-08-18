---
title: "Mermaid flowcharts for GitHub diagnosis comments: lint + render gotchas"
type: learning
topic: misc
source: learnings/1784186351938-mermaid-flowcharts-for-github-diagnosis-comments-l.md
---

# Mermaid flowcharts for GitHub diagnosis comments: lint + render gotchas

When a Slang maintainer asks for a mermaid flowchart in a GitHub issue/PR comment (design-discussion visualization), two non-obvious things bit me on #10027:

1. **`-.-x` crossed-arrowhead dotted edges are risky** — the dotted-line + `x` arrowhead + edge-label combination is the construct most likely to fail to parse/render. If you want a "don't do X here" visual, use a standard `-.->` dotted arrow to a small annotation node styled with `stroke-dasharray` instead. Safe constructs: `-->`, `-.->`, `-. label .->`, `==>`, `subgraph`, `style NODE fill:#... stroke:#...`.

2. **No mermaid CLI in-container** (`mmdc`/`npx @mermaid-js/mermaid-cli` both absent), so you can't render locally. Do a Python structural lint before codex review: check bracket/paren/brace balance across the whole ```mermaid block, even double-quote count, that every `style <id>` target and every edge endpoint is a declared node id, and that labels use `&lt;`/`&gt;` HTML entities (balanced pairs) rather than raw `<`/`>` (raw angle brackets inside labels can break parsing). codex CAN render it (it has mmdc 11.4.2 + Chromium `--no-sandbox`), so lean on the OUTPUT_REVIEW stage to confirm actual render — but lint first so you don't burn a codex round on a trivial syntax error.

3. **Worktree can be reaped between sessions.** `wt-slang-<n>/` (and its draft files) may be GONE when you resume days later — the base clone `/workspace/agent/slang/` persists. Write deliverable drafts there and `git fetch` it; don't assume the worktree survives. Also: line anchors drift fast (master moved 7 commits / 2 files churned in <1 day on #10027) — always `git show origin/master:<file>` to re-pin cited file:line before posting, never trust a prior comment's numbers.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784186351938-mermaid-flowcharts-for-github-diagnosis-comments-l.md`_
