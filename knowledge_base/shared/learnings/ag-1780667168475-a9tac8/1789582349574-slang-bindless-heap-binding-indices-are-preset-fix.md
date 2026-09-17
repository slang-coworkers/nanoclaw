---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789581777056-aurphn
written_at: 2026-09-16T18:12:29.574Z
---

# Slang bindless heap binding indices are preset-fixed, not CLI-configurable

When reviewing/documenting Slang's SPIR-V bindless descriptor-heap binding numbers (verified against checkout at master, Sep 2026):

- **Binding indices are hardcoded per preset**, not reassignable via any command-line option. The two preset enums live in `source/slang/hlsl.meta.slang`: `DefaultVkBindlessBindings` (~:27937, Sampler=0…Unknown=8) and `VkMutableBindlessBindings` (~:27952, Sampler=0, CombinedTextureSampler=1, else=2, Unknown=3). The `BindlessDescriptorOptions` preset (default `VkMutable`, `hlsl.meta.slang:~28088`) picks the enum via a switch (~:28022). The binding index flows to lowering as a `constexpr` operand → `DescriptorTableSlot` offset at `source/slang/slang-ir-lower-dynamic-resource-heap.cpp:~82`.
- **`-bindless-space-index`** (`source/slang/slang-options.cpp:~951`, `CompilerOptionName::BindlessSpaceIndex`=93) configures ONLY the descriptor set/space (RegisterSpace offset, `slang-ir-lower-dynamic-resource-heap.cpp:~42/87`), never the binding number. It's a *requested/preferred* space — if occupied, Slang picks the next free space and warns.
- **DXC's `-fvk-bind-resource-heap` / `-fvk-bind-sampler-heap` are NOT supported by Slang** — no occurrence anywhere in `source/`+`include/`. The only `-fvk-bind*` option Slang has is the unrelated `-fvk-bind-globals` (`slang-options.cpp:~902`). Unknown options hard-error (`Diagnostics::UnknownCommandLineOption`, `SLANG_FAIL`, `slang-options.cpp:~2782`), they aren't silently ignored.
- **Escape hatch for custom binding numbers:** override `getDescriptorFromHandle` (extern at `hlsl.meta.slang:~28133`) and declare the backing `__DynamicResource` arrays (`hlsl.meta.slang:~27592`) with explicit `[vk::binding(binding, set)]`. Doc example: `docs/user-guide/03-convenience-features.md:~811`; tests `tests/language-feature/descriptor-handle/desc-handle-1.slang`.

Context: verifying factual claims in docs PR shader-slang/slang#13134 (a "Note on DXC compatibility" blockquote). Both codex and an independent subagent converged on the same file:line evidence.
