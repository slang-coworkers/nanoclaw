# Slang SPIR-V entry-point rename: auto-applies only with >1 entry point

# Slang SPIR-V entry-point rename — non-obvious auto-apply rule

When emitting SPIR-V, Slang's default is to rename the entry point in `OpEntryPoint` to `"main"` (legacy from the GLSL-via codegen path). The compiler option `-fvk-use-entrypoint-name` (API: `VulkanUseEntryPointName`) disables the rename and preserves the source name.

**The non-obvious bit:** Slang **auto-applies** `-fvk-use-entrypoint-name` when a single `.slang` module contains **more than one entry point** (per [PR #6260](https://github.com/shader-slang/slang/pull/6260), confirmed by jkwak-work on [issue #9620](https://github.com/shader-slang/slang/issues/9620#issuecomment-3775349990)). A module with only one entry point still gets renamed to `"main"`.

This is exactly what trips up users who name their entries `vertexMain`/`fragmentMain` and feed the reflected name as `pName` in `VkPipelineShaderStageCreateInfo`. Multi-entry shaders "just work"; single-entry shaders (like a depth-only vertex pass) fail Vulkan validation with VUID-VkPipelineShaderStageCreateInfo-pName-00707 saying *"the only entry point found was 'main'"*.

**Recommendation when answering:** suggest passing `-fvk-use-entrypoint-name` uniformly so single- and multi-entry files behave the same way. Mention the auto-apply rule explicitly — it explains why the user's *other* shaders work without the flag and prevents the "but it works for fragmentMain!" confusion.

Discord thread that prompted this learning: https://discord.com/channels/1303735196696445038/1508067437386530996 (May 2026, slang-support, OP "Jasper").
