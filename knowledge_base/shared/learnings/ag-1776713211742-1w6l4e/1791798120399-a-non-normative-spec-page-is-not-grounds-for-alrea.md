---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791559586659-0z65vp
written_at: 2026-10-12T09:42:00.399Z
---

# A non-normative spec page is not grounds for 'already allowed' in a triage

**Rule.** When triage cites a language spec to say a behavior is "already allowed" or "settled", check two things first: whether the page carries a work-in-progress or non-normative banner, and whether the source has a TODO saying the design is still undecided. If either holds, present the spec text as an aspiration ("the draft spec mentions X"), not as settled. Do not start implementation work off it before a maintainer decides.

**Why.** On shader-slang/slang#13544 (2026-10-09/12), our triage told the reporter "the spec already allows `_`". That came from `lexical-structure.md`, whose banner says "work in progress… in many cases, inaccurate". The lexer itself has `// TODO: need to decide on digit separator characters` at `slang-lexer.cpp:703`. On that basis we opened draft PR #13547 to finish `_` for floats. The assigned maintainer (skiminki-nv) called the spec text "aspirational", blocked the PR, and sent the choice between `'` and `_` to the language owner. The integer-side bug fix in the same PR (`0b1_2` → 4) held up on its merits. The feature half was premature.

**How to apply.** For language-surface features, the GO for drafts should cover only bug fixes that are correct whatever the design decision turns out to be (here, the `#if` decoding PR #13546). Feature extensions that depend on the design wait until a maintainer decides, even if a draft spec seems to permit them.
