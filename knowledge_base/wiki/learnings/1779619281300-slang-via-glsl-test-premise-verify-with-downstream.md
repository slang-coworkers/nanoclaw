---
title: "slang-via-glsl-test-premise-verify-with-downstream-tool"
type: learning
topic: slang-compiler
source: learnings/1779619281300-slang-via-glsl-test-premise-verify-with-downstream.md
---

# slang-via-glsl-test-premise-verify-with-downstream-tool

# `-emit-spirv-via-glsl` tests that rely on glslang to "already do the right thing" need verification against glslang source

**The trap** — A Slang regression test on the `-emit-spirv-via-glsl` path that says in its header "glslang owns the X decoration and already produces it correctly today, we just pin it" is making an empirical claim about the downstream compiler. That claim must be verified against glslang source — not assumed from the test passing locally on a single configuration.

**Concrete instance (PR #11265, Dec 2026)** — `tests/spirv/builtin-volatile-via-glsl.slang` claimed glslang adds `OpDecorate %V Volatile` on subgroup builtins (e.g. `gl_SubgroupInvocationID`) when used in raytracing stages. Two independent DeepWiki investigations contradicted this:

- **Slang's GLSL emitter** (`source/slang/slang-emit-glsl.cpp`) only writes `volatile` for `IRMemoryQualifierSetDecoration` with `kVolatile` flag (user-authored qualifier on shader-storage variables). Never adds it stage-aware for subgroup builtins.
- **glslang's `GlslangToSpv`** (`SPIRV/GlslangToSpv.cpp`) `TranslateMemoryDecoration` adds `Volatile` only when the GLSL source's `qualifier.isVolatile()` is true; `TranslateMemoryAccess` adds it only when the Vulkan memory model is enabled and `coherentFlags.volatil` is set. `TranslateBuiltInDecoration` for `EbvSubGroupInvocation` etc. adds capabilities + extensions only — no raytracing-stage-aware Volatile injection.

If both downstreams agree they don't add Volatile, the test should fail. Either there's an undocumented path (Slang flag, GLSL extension, glslang version-specific behavior) that does add it, or the test is silently failing.

**How to verify before approving such a test:**
1. `gh pr diff <PR>` — confirm whether the PR touches `slang-emit-glsl.cpp`, `glsl.meta.slang`, or vendored glslang code. If it doesn't, the via-GLSL Volatile guarantee must come from pre-existing behavior — and that needs proof.
2. Use `mcp__deepwiki__ask_question` on `KhronosGroup/glslang` to verify the downstream's actual behavior. Ask specifically about `TranslateMemoryDecoration`, `TranslateBuiltInDecoration`, and stage-aware Volatile injection.
3. Ask the PR author to attach the local `slang-test tests/spirv/<test>.slang` log showing the test passes.
4. If steps 2 and 3 disagree (downstream claims no, fixer claims test passes), the path likely involves an extension or memory-model branch — push for the path to be documented in the test header.

**Apply when:**
- Reviewing PRs that add `-emit-spirv-via-glsl` regression tests.
- Reviewing PRs that pin "downstream tool already does X" behavior — the claim is empirical and brittle.
- Auditing tests that don't have a corresponding source-code change to back the asserted behavior.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779619281300-slang-via-glsl-test-premise-verify-with-downstream.md`_
