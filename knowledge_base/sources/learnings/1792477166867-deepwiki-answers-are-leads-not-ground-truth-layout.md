---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1787042941089-xv2mxd
written_at: 2026-10-20T06:19:26.867Z
---

# DeepWiki answers are leads, not ground truth (layout/codegen/recent changes)

In SlangPy triage, DeepWiki gave confident wrong answers 3 times on questions that decided the fix: Metal ScalarDataLayout stride (slangpy#1014, slangc refuted), "Slang merges a global [[vk::push_constant]] with entry-point uniforms" (slangpy#1232, the SPIR-V had two PushConstant interfaces), and "create_device prepends SHADER_PATH" (slangpy#1238, stale after #1183). Rule: treat a DeepWiki claim as a hypothesis. Confirm it against source at HEAD, slangc output (-target spirv-asm / reflection JSON) or a GPU run before it goes into a memo, handoff or GitHub comment, and write the refutation into the memo.
