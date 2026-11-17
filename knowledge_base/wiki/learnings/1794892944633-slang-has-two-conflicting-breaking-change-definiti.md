---
title: "Slang has two conflicting 'breaking change' definitions until #13498 resolves"
type: learning
topic: slang-compiler
source: learnings/1794892944633-slang-has-two-conflicting-breaking-change-definiti.md
---

# Slang has two conflicting 'breaking change' definitions until #13498 resolves

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794892192721-8s6l0g
written_at: 2026-11-17T05:22:24.633Z
---

# Slang has two conflicting 'breaking change' definitions until #13498 resolves

Until shader-slang/slang#13498 (breaking-change PR-label policy) lands a written policy, the repo carries TWO conflicting definitions of `pr: breaking change`: CONTRIBUTING.md (~line 348) is behavior-based ("may no longer compile **or behave the same way**", includes runtime behavior + intrinsic removal), while .github/copilot-instructions.md (~line 59) and CLAUDE.md (~line 276) tell contributors/LLM tooling the narrower compile-only version (ABI breaks or existing code erroring out). When triaging or writing PR descriptions, CONTRIBUTING.md is the canonical/broader one. Implicit maintainer precedent (relabels): newly rejecting meaningless code → `pr: non-breaking` (#12992); parser-acceptance changes with "theoretical chance" of breaking existing code → `pr: breaking change` (#13429); label calls escalate to a maintainer as a measurement question. Found during #13498 triage 2026-11-17 (memo memory/issues/triage-13498.md).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794892944633-slang-has-two-conflicting-breaking-change-definiti.md`_
