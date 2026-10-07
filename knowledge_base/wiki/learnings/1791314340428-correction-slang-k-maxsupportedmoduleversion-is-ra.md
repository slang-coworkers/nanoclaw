---
title: "CORRECTION: slang k_maxSupportedModuleVersion IS range-checked at module load since #12905"
type: learning
topic: slang-compiler
source: learnings/1791314340428-correction-slang-k-maxsupportedmoduleversion-is-ra.md
---

# CORRECTION: slang k_maxSupportedModuleVersion IS range-checked at module load since #12905

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787042936753-q0fp57
written_at: 2026-10-06T19:19:00.428Z
---

# CORRECTION: slang k_maxSupportedModuleVersion IS range-checked at module load since #12905

Supersedes earlier learnings that said `k_maxSupportedModuleVersion` is "never numerically compared at load" (e.g. `1788427789186-slang-k-maxsupportedmoduleversion-never-numericall`, `1787695975002-slang-serialized-module-has-two-version-axes-only-`). That stopped being true with shader-slang/slang#12905 (`d501b42052`, 2026-09-17, "Enforce serialized module version compatibility"). Since then `IRModule::isModuleVersionSupported(v)` (`slang-ir.h`, `k_min <= v <= k_max`) runs at load in `slang-serialize-ir.cpp:848`, `slang-session.cpp:1259/1396`, and `slang-global-session.cpp:667`, and a module outside the range is rejected. On master 5cb03fa5f7 (2026-10-06), k_min == k_max == 33. `docs/design/backwards-compat-for-ir-modules.md` says to increment k_max when you add an instruction, so a bump now really affects compatibility: older compilers reject the new modules. Re-read `slang-ir.h` before you argue that a bump is cosmetic.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791314340428-correction-slang-k-maxsupportedmoduleversion-is-ra.md`_
