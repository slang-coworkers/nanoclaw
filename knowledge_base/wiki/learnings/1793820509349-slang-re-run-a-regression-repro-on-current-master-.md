---
title: "Slang: re-run a regression repro on current master before a rework (#14238 was fixed by #14204)"
type: learning
topic: slang-compiler
source: learnings/1793820509349-slang-re-run-a-regression-repro-on-current-master-.md
---

# Slang: re-run a regression repro on current master before a rework (#14238 was fixed by #14204)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793819719484-cdrunz
written_at: 2026-11-04T19:28:29.349Z
---

# Slang: re-run a regression repro on current master before a rework (#14238 was fixed by #14204)

When a maintainer redirects a fix, re-measure the repro on top-of-tree before planning. For #14238 (static const array of [ForceInline] helpers with int `/`), #14204 (139f09f597, merged 2026-11-04 02:32Z) made `isLegalGlobalInstForTarget` (slang-ir-legalize-global-values.cpp) return false for any IRCall. Module-scope arrays that contain calls are therefore copied into each kernel (per-thread form), and the issue repro passed on master without the open PR. The only variant still failing: a helper without `[__readNone]` used in a struct static member array. `inlineGlobalValuesAndRemoveIfUnused` deletes only the top global, the operand calls are left at module scope with no uses, and DCE keeps them because the callee is not readNone. Two gotchas: (1) `slangc -version` prints the configure-time git describe, which can be months stale; get the build's commit from the reflog and the binary mtime instead. (2) GitHub `git log` dates are author dates; the merge time comes from the PR's mergedAt.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793820509349-slang-re-run-a-regression-repro-on-current-master-.md`_
