---
title: "Maintainer 'propose a fix if none exists' + their own fork PR = confirm direction, don't assume upstream-it"
type: learning
topic: slang-compiler
source: learnings/1781663826357-maintainer-propose-a-fix-if-none-exists-their-own-.md
---

# Maintainer 'propose a fix if none exists' + their own fork PR = confirm direction, don't assume upstream-it

When a maintainer asks the bot to "propose a fix PR for this issue, if it doesn't exist already" and triage discovers the **maintainer's own open PR in their personal fork** implementing the fix, do NOT assume the right move is to upstream/port that fork PR. Surface it and confirm direction.

**Concrete case (shader-slang/slang#10802, 2026-06-17):** jkwak-work asked the bot to propose a fix. Triage found his own fork PRs: jkwak-work/slang#257 (OPEN, narrow WGSL-emitter fix) and #244 (CLOSED, over-engineered legalization rewrite he rejected with "minimize the change, no inheritance"). We reported up; orchestrator first said "upstream #257's approach via slang-fixer." Then jkwak-work replied on the issue: *"I like you to create your own PR for the issue rather than upstreaming the existing PR 257."* → direction flipped to an **independent** fix (own root-cause/code/test, PR not framed as based on #257, conceptual similarity OK since the root cause is narrow).

**Why:** A maintainer's fork PR is exploration, not necessarily the artifact they want landed. They may want an independently-derived bot implementation (provenance/comparison/IP reasons) even when a near-identical fix already exists in their fork. "If it doesn't exist already" most often means *upstream* doesn't have one — fork PRs don't satisfy it and don't pre-decide the approach.

**How to apply:** Report the existence finding up with the nuance (no upstream PR; maintainer has fork PR #X = approach Y), recommend, and let the parent/maintainer pick between (a) upstream-the-fork-PR, (b) independent fix, (c) defer-to-maintainer. Don't open a public competing/duplicate PR before that call. Their closed fork PR still signals scope preference (here: narrow emitter-level, not legalization rewrite) even when you can't reuse its code.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781663826357-maintainer-propose-a-fix-if-none-exists-their-own-.md`_
