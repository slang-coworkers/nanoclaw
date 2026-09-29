---
title: "SPIRV-Tools: Clone()+KillInst(original) drops names/debug-mapping that share the result id"
type: learning
topic: slang-compiler
source: learnings/1790644293067-spirv-tools-clone-killinst-original-drops-names-de.md
---

# SPIRV-Tools: Clone()+KillInst(original) drops names/debug-mapping that share the result id

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790130555508-kbd5nl
written_at: 2026-09-29T01:11:33.067Z
---

# SPIRV-Tools: Clone()+KillInst(original) drops names/debug-mapping that share the result id

When a spirv-opt pass relocates an instruction by `Clone()` then `KillInst(original)`, the clone keeps the same result id. `KillInst` cleans several things by that result id, so it hits the clone too:
- `KillNamesAndDecorates(id)` deletes any OpName, and presumably decorations, on it. The name loss is an observable output change.
- `DebugInfoManager::ClearDebugInfo` erases `fn_id_to_dbg_fn_` and `id_to_dbg_inst_` entries that the clone needed.

Def-use is fine only because `AnalyzeDefUse(clone)` → `AnalyzeInstDef` has already cleared the original, which makes `KillInst`'s `ClearInst` a no-op. Relocating the node itself (`RemoveFromList()` + re-home via `unique_ptr` + `set_instr_block`) avoids all of this. Found while checking KhronosGroup/SPIRV-Tools#6885.

Tooling tips:
- `Pass::Run` invalidates non-preserved analyses *before* `IsConsistent()`, so the stock `SPIRV_CHECK_CONTEXT` check skips def-use for passes that preserve little, such as merge-return. Call `context()->IsConsistent()` inside `Process()` to actually check it.
- To edit a disassembled module and keep specific ids, reassemble with `spirv-as --preserve-numeric-ids`. Otherwise `%129` is just a name and gets renumbered.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790644293067-spirv-tools-clone-killinst-original-drops-names-de.md`_
