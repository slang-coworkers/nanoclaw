---
title: "import-vs-include reflection/binding loss = missing IComponentType::link()"
type: learning
topic: slang-compiler
source: learnings/1782215579233-import-vs-include-reflection-binding-loss-missing-.md
---

# import-vs-include reflection/binding loss = missing IComponentType::link()

**Symptom (slang #7877):** A global resource with `[[vk::binding(n,set)]]` reflects + emits its DescriptorSet/Binding correctly via `#include`, but via `import module;` reflection returns nothing (`getParameterCount()==0`) and the SPIR-V is missing the DescriptorSet decoration (Vulkan validation fails). Maintainers often CANNOT reproduce via `slangc` — only via the C++ API.

**Root cause:** the host composes `{module, entryPoint}` and calls `getLayout()`/`getEntryPointCode()` directly on the composite, **without calling `IComponentType::link()` first.** An `import`ed module's globals are recorded as *requirements* (slang-check-shader.cpp `Module::_collectShaderParams` :2207, `m_requirements.add` :2310 — intentional, comment :2214), NOT as the importing module's own shader params. `fillRequirements` (slang-check-shader.cpp:2344) folds requirement modules into the layout, and it runs **only from `ComponentType::link()`** (slang-linkable.cpp:461,477). `ComponentType::getLayout()` (slang-linkable.cpp:119-131) does NOT fill requirements. `#include` decls become `FileDecl`s inside the importing module → collected directly → immune to the missing link(). `slangc`/`-reflection-json` link before reflecting → no repro.

**Fix for the user:** `composed->link(program.writeRef(), ...)` then use `program` for BOTH `getEntryPointCode()` and `getLayout()`.

**Triage lessons:**
1. "slangc works but the C++ API doesn't" for module/reflection bugs → suspect the link() step. slangc's path (`createUnspecializedGlobalComponentType` → fillRequirements) always links; the minimal API composite does not.
2. Reproduce these via the public API, not slangc. There's a ready-made vehicle: build a tiny harness against `build/Debug/lib/libslang.so` + `include/` (g++ -std=c++17 -I include x.cpp -lslang -Wl,-rpath,.../lib). NOTE: `ComPtr` is in namespace `Slang`, not `slang`. `examples/reflection-api/main.cpp` shows the canonical loadModule→compose→**link**→getLayout flow (it composes entry-points-only and DOES link).
3. Download a reporter's GitHub attachment zip with `curl -sL -o f.zip "https://github.com/user-attachments/files/<id>/<name>.zip"` — reading their actual host code is often the fastest way to spot a missing-link()-class API misuse.
4. Open compiler-side question for these (worth recommending): should getLayout()/getEntryPointCode() on a component with unfilled requirements diagnose loudly (Approach A) or auto-fill (Approach B, semantics change), rather than silently produce an incomplete layout + invalid SPIR-V.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782215579233-import-vs-include-reflection-binding-loss-missing-.md`_
