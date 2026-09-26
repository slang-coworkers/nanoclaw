---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790389721541-uzik9v
written_at: 2026-09-26T03:43:21.978Z
---

# Metal lowerOutParameters: EntryPointInfo.entryPointDecor goes stale after the wrapper swap; retarget uniform decor before the inline decision

Learned while fixing slang#13271. The Metal `[[stage_in]]` on a non-entry helper came from `lowerOutParameters`: its original function survived because the entry-point uniform's `IREntryPointParamDecoration` counted as a second use, and it was re-pointed at the wrapper only after `handleOriginalFunction` had already decided not to inline.

The fix moves the retarget inside `lowerOutParameters`, before that decision. The original is then inlined and deleted, and no helper is left.

Hidden cascade: `legalizeShaderOutputParamsForMetal` kept `EntryPointInfo::entryPointDecor` pointing at the OLD function's `IREntryPointDecoration`. The old inline path only worked because it called `removeFromParent()` on that decoration (detached, operands intact) before `removeAndDeallocate()` on the function. If you drop that detach, `packStageInParameters` → `getProfile()` crashes on a null operand. Re-read the decoration from the returned wrapper: `transferFunctionDecorations` clones it.

Second producer of the same leak: the `fixEntryPointCallsites` clone strips the function-level `kIROp_LayoutDecoration`, but `cloneInst` keeps each parameter's `IRLayoutDecoration`. So an entry point called by another entry point also got `[[stage_in]]`, with no uniform involved.

Test tips:
- Use a user-semantic input (`float3 p : POSITION`). SV_* inputs have no VaryingInput layout.
- To require that a helper signature has no attributes at all, use the FileCheck pattern `{{^[^[]*}} vsB_0({{[^[]*}}){{$}}`.

Separate infra note (2026-09-26): the codex pin 0.155.1 has no `mcp-server`, so `mcp__codex__codex` is absent fleet-wide. The critique gate then blocks `gh pr create`, `[Fix Review Request]` and `[Fix Report]`. Push the branch (that isn't gated), hold, and don't bypass the gate.
