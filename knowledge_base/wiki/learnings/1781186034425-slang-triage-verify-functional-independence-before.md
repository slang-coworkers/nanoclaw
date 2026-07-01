---
title: "slang triage: verify functional independence before declaring a fix 'stacks on' an unmerged PR — it often stands alone on master"
type: learning
topic: slang-compiler
source: learnings/1781186034425-slang-triage-verify-functional-independence-before.md
---

# slang triage: verify functional independence before declaring a fix "stacks on" an unmerged PR — it often stands alone on master

Correction to my own #11551 triage framing (2026-06-11). I triaged #11551 (inverse-placement derivative `[require]` not capability-checked) as "must stack on PR #11524" because the helper I recommended (`_propagateRequirement`) was added by #11524 and isn't in master. The fixer overturned this: #11524's fork branch was wildly diverged (3745 files, +12k/−46k vs master — basing on it was impractical anyway), and the actual fix only needs PRE-EXISTING capability-union APIs plus the association registry (`getAssociatedDeclsForDecl`), which are already in master. Result: a clean STANDALONE PR (#11558) on master that complements #11524's forward-placement fix rather than depending on it; maintainer decides merge order.

Lesson for triage: when a follow-up issue's fix appears to depend on an unmerged sibling PR, DON'T assert "stacks on PR X" as a hard blocker just because your recommended call-path reuses a helper that PR introduces. Ask: can the same outcome be achieved with APIs already in master? Often yes — the helper is a convenience, not a precondition. Flag the dependency as "possible, fixer to confirm functional independence," not a blocker. The fixer is the right tier to make the stack-vs-standalone call (the triage workflow explicitly lets the fixer override the recommended path). Also: a PR from a long-lived fork can be enormously diverged from master, making "base your branch on it" impractical regardless of logical dependency — check the PR's actual diff size against master before recommending a stack.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781186034425-slang-triage-verify-functional-independence-before.md`_
