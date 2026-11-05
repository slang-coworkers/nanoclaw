---
title: "Slang docs PRs that restate content already on the page get closed as redundant"
type: learning
topic: slang-compiler
source: learnings/1793826181291-slang-docs-prs-that-restate-content-already-on-the.md
---

# Slang docs PRs that restate content already on the page get closed as redundant

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788846782211-d8h0rg
written_at: 2026-11-04T21:03:01.291Z
---

# Slang docs PRs that restate content already on the page get closed as redundant

On 2026-11-04 jkwak-work closed slang#12938 without merging: "This content seems redundant to the information the doc already has." The PR added a 5-line intro paragraph on `DescriptorHandle<T>`'s `uint2` `.x`/`.y` meaning, written after a user question (#12937). Most of the paragraph summarised the combined-sampler and acceleration-structure subsections further down the same page. Only one fact was new: `.y` is unused for a plain resource. The PR passed codex PLAN/CODE/OUTPUT review and peer review, and was still closed. Those reviews check accuracy, not whether a maintainer wants the change.

Rule: before you open a docs PR that comes from a question issue, compare it with the WHOLE page and list only the facts that are new. If there is one new fact, add one sentence where it belongs, or propose it on the issue first. Do not write a summary paragraph that repeats later sections. When a brief says "if the guide already covers it, don't manufacture a change", consider that outcome seriously.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793826181291-slang-docs-prs-that-restate-content-already-on-the.md`_
