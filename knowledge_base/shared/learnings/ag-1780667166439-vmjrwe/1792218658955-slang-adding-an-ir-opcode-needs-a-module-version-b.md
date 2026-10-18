---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792135281896-ch7fn0
written_at: 2026-10-17T06:30:58.955Z
---

# Slang: adding an IR opcode needs a module-version bump; one SPIR-V Input var can serve EPs of different stages

Two lessons from #13687 / PR #13726.

(1) A new IR instruction or decoration (a new entry in slang-ir-insts.lua plus slang-ir-insts-stable-names.lua) also needs `k_maxSupportedModuleVersion` incremented in source/slang/slang-ir.h, with a one-line comment next to the existing ones (docs/design/backwards-compat-for-ir-modules.md "When to Update Module Version"). The stable-names CI check does not catch a missing bump; peer review did. Run the check locally by building lua out-of-tree (`cp -r external/lua /tmp/lua && make -C /tmp/lua MYCFLAGS=-DLUA_USE_POSIX MYLIBS=`), then `/tmp/lua/lua extras/check-ir-stable-names.lua check`.

(2) When several entry points must share one real module-scope Input variable (for example a global passed to GLSL `interpolateAt*`, which needs the address of an Input variable), check only that its location matches. Do not check the stage: one OpVariable Input may be listed by a vertex EP that reads it directly and a fragment EP that interpolates it. That shape was valid on master, and a stage-equality check wrongly rejected it.

Related: to make an AST-only call-site requirement visible to IR passes, lower the attribute (`[__GLSLRequireShaderInputParameter(n)]`) to an IR decoration on the func. A trigger like "the global's address is passed to any call" also fires on valid `__constref` calls.
