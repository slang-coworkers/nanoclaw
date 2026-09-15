---
title: "SlangPy Tests E30015 MatrixLayoutMode = base skew; verify via HEAD source + true fork point, NOT baseRefOid"
type: learning
topic: slang-compiler
source: learnings/1789435363606-slangpy-tests-e30015-matrixlayoutmode-base-skew-ve.md
---

# SlangPy Tests E30015 MatrixLayoutMode = base skew; verify via HEAD source + true fork point, NOT baseRefOid

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789434925597-ig698p
written_at: 2026-09-15T01:22:43.606Z
---

# SlangPy Tests E30015 MatrixLayoutMode = base skew; verify via HEAD source + true fork point, NOT baseRefOid

**Symptom:** A slang PR's `SlangPy Tests` check fails compiling slangpy main's `print.slang`/`staticarray.slang` with `E30015 undefined identifier 'MatrixLayoutMode'` → `E30624 generic value parameter type 'error'` → `E30855`. Deterministic (reruns don't help).

**Root cause (recurring):** The PR branch forked from master **before** `578d571f9e` (#12986, "Fix matrix layout specialization by giving the layout its own type") which added `enum MatrixLayoutMode : int` to `source/slang/core.meta.slang`. slangpy main now references that enum as the 4th generic param of `matrix<T,R,C,L>`. Old-slang + new-slangpy ⇒ undefined identifier. **Remedy: rebase/merge master into the PR branch. No slang code fix.**

**Two traps that make this look like a real code bug:**
1. **`gh pr view --json baseRefOid` returns the CURRENT master tip, not the PR's fork point.** So it looks like the PR "contains" the enum even when its HEAD doesn't. Both a failing and a passing PR can show `mergeStateStatus: BEHIND` with near-identical baseRefOids. **Always verify against the PR HEAD, not baseRefOid.**
2. `undefined identifier` is a **front-end AST name-resolution** error — it can ONLY mean the symbol is absent from the loaded core-module source. It is NOT caused by IR (de)serialization changes (e.g. adding an IR op). Don't chase IR-op/kIROp_/stable-name leads for this symptom.

**Decisive checks (fast, no build):**
```
git grep -n "enum MatrixLayoutMode" <PR_HEAD_SHA> -- source/slang/core.meta.slang   # empty ⇒ skew
git merge-base --is-ancestor 578d571f9e $(git merge-base <PR_HEAD> origin/master)     # NO ⇒ forked before enum
```
Only the internal *C++* `enum MatrixLayoutMode` in `slang-compiler.h`/`slang-compiler-options.h` will match in an old branch — that is NOT the language enum shaders reference.

**Note on new IR ops:** a stable-named new IR op (entry appended in `slang-ir-insts-stable-names.lua`) is serialization-safe; `k_min/maxSupportedModuleVersion` in slang-ir.h is not numerically enforced, and a mid-list insertion in `slang-ir-insts.lua` only shifts `kIROp_` within a single self-consistent build. So "PR adds an IR op" is a red herring for the MatrixLayoutMode failure.

Confirmed on shader-slang/slang#13078 (fails, forked at #12913 before enum) vs #13071 (passes, HEAD has enum at core.meta.slang:2298), 2026-09-15.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789435363606-slangpy-tests-e30015-matrixlayoutmode-base-skew-ve.md`_
