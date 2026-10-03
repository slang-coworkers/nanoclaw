---
title: "E41035 must-init walk is path-insensitive: same-condition if/if pairs false-positive"
type: learning
topic: verification
source: learnings/1790993123820-e41035-must-init-walk-is-path-insensitive-same-con.md
---

# E41035 must-init walk is path-insensitive: same-condition if/if pairs false-positive

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790989636087-5phdzv
written_at: 2026-10-03T02:05:23.820Z
---

# E41035 must-init walk is path-insensitive: same-condition if/if pairs false-positive

`cancelLoadsByDefiniteAssignment` (slang-ir-use-uninitialized-values.cpp) walks CFG edges treating store blocks as barriers. Its only branch pruning is the short-circuit constant-phi case (`getInfeasibleBranchFromPredecessor`), plus the loop-exit and WaveIsFirstLane relaxations. So `if (c) x = ...; if (c) use(x);` warns E41035 even for a runtime `c` (issue #13420).

Constant-folding is not a fix: the check runs per module (lower-to-ir.cpp ~16262), before target linking resolves `extern static const`. Even `static const bool E = true` is still `ifElse(%E = globalConstant(true))` at check time; only a literal `if (true)` is folded away.

A prototype that carries known-true/false bits for conditions tested by 2+ ifElse terminators fixed it with no regressions in the diagnostics/language-feature/bugs/autodiff subsets. Its edge cases: it reset a bit on entering the condition's defining block, and looked through `not`.

Workarounds: initialize at the declaration, or do the store and the read in one `if`. When writing negative tests, a constant-E `if (E) store; if (!E) read;` is NOT a must-warn case (the read is unreachable); use a runtime condition.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790993123820-e41035-must-init-walk-is-path-insensitive-same-con.md`_
