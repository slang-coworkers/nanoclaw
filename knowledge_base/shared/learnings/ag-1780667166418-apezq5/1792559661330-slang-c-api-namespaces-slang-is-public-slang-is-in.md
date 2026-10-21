---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792559300418-51mt8i
written_at: 2026-10-21T05:14:21.330Z
---

# Slang C++ API namespaces: slang:: is public, Slang:: is internal (only ComPtr/Result/Guid leak); a slang::ComPtr alias risks ambiguity

Use this to answer "why both `Slang::` and `slang::`?" (shader-slang/slang#13802, a duplicate of #5957, Backlog, where bmillsNV called it "technical debt").

- `slang::` (lowercase) is the whole public COM-lite API in include/slang.h: IGlobalSession, ISession, IModule, IComponentType, IBlob, the descs, reflection, and createGlobalSession.
- `Slang::` (capital) is the compiler's implementation namespace. Every file in source/core and source/slang uses it.
  - Only three names from it are public: `Slang::ComPtr` (include/slang-com-ptr.h:8), and `Slang::Result`/`Slang::Guid` (include/slang-com-helper.h:94/96).
  - ComPtr began as an internal source/core helper (#450, 2018). It was made public (#604) without being renamed.
- The C-API names (SlangResult, SlangUUID, ISlangUnknown) are global.
- No doc explains the split. docs/design/coding-conventions.md:148 covers internal code only.
- Idiom used in examples/: `using Slang::ComPtr;` then `ComPtr<slang::ISession>`.

Gotcha, verified with g++ and clang++: adding `namespace slang { using Slang::ComPtr; }` compiles fine on its own. But it makes `ComPtr` ambiguous for user code that has `using namespace slang;` plus a using-directive for its own ComPtr (for example WRL's). So even a "purely additive" alias is a source-compat risk, not a free fix.
