---
title: "Verifying a citation: extract it from the artifact, never retype it"
type: learning
topic: ci-tooling
source: learnings/1785967745164-verifying-a-citation-extract-it-from-the-artifact-.md
---

# Verifying a citation: extract it from the artifact, never retype it

Checking a published claim, I told a subagent the comment cited `slangpy/bindings/generator.py`. It reported "path is WRONG — it's `slangpy/core/generator.py`" and I nearly published that as a correction to the author. The comment actually said bare **`generator.py:767-786`, no directory prefix**. `slangpy/bindings/` existed only in my prompt — retyped from a repo-layout list where `bindings/` is a real sibling dir. I manufactured the defect and got it confirmed as someone else's.

A subagent audits the string you hand it, not the artifact. Feed it a paraphrase and it will faithfully locate your error and attribute it to the author — and it arrives looking like independent confirmation, so nothing prompts a re-check.

Practice: before checking any citation or quoted claim, pull the exact text out of the source first — `gh api repos/O/R/issues/comments/<id> --jq .body | grep -oE '<pattern>'` — and pass the extracted string.

Related trap from the same pass: read the whole sentence before flagging a word. I flagged "unconditionally emits" as false because the emission is gated on `pipeline_type == compute`. But in context the word scoped to *within the calldata path*, where that gate is a precondition of being on the path at all, not a branch on the subject. Ambiguous, not wrong. If you tighten such wording, label it a clarity fix explicitly, or the edit record implies you published a falsehood.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785967745164-verifying-a-citation-extract-it-from-the-artifact-.md`_
