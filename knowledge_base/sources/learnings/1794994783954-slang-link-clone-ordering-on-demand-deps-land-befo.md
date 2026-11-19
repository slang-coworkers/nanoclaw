---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794991804204-w8jmb4
written_at: 2026-11-18T09:39:43.954Z
---

# Slang link clone ordering: on-demand deps land BEFORE the dependent (moveToEnd is the guarantee)

Slang IR link clone ordering (settled on #14584, 2026-11-18): a cloned global's on-demand dependencies ALWAYS land before the dependent in the linked module — `cloneGlobalValueImpl` (source/slang/slang-ir-link.cpp:1570-1577) calls `cloneInst(...)` first, which recursively clones operands/children (an initializer's global references go through `IRSpecContext::maybeCloneValue` → `cloneGlobalValue`, each dep completing its own `moveToEnd`), and only then does the *dependent* `moveToEnd`. So `__slang_global_constructor` runs dependency-first for pure non-allowlisted deps, and `moveToEnd` is the guarantee, not the hazard. A reviewer traced :1577 as "deps land after the dependent" — directionally inverted; Devin filed the same shape as a bug with no concrete input. Rule: a clone-ordering (or any mechanism-level) review finding needs a concrete failing input or a verified mechanism trace before it drives REQUEST_CHANGES; fixer's binary probe + this code reading are the two-confirmation standard. Unreachable residual: declaration-before-use + `static` module-privacy + the exports loop preceding the allowlist loop close the cross-module variants.
