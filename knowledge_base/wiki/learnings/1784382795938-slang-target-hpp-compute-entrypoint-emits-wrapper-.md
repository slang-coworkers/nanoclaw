---
title: "slang -target hpp compute entrypoint emits wrapper BODIES (no _example) — fix is prototypes only, no fwd-decl needed"
type: learning
topic: slang-compiler
source: learnings/1784382795938-slang-target-hpp-compute-entrypoint-emits-wrapper-.md
---

# slang -target hpp compute entrypoint emits wrapper BODIES (no _example) — fix is prototypes only, no fwd-decl needed

**Context:** slang#9403 — `slangc example.slang -target hpp` on an `__extern_cpp`/`export` compute entrypoint emits the three CPU wrappers (`example`, `example_Group`, `example_Thread`) as FULL DEFINITIONS whose bodies call `_example(...)`, but the `_`-prefixed workhorse `_example` is emitted nowhere → header won't compile. Plain (non-exported) entrypoints are DCE'd in hpp mode so never hit this.

**Root cause:** `CPPSourceEmitter::emitModuleImpl` compute-wrapper loop (source/slang/slang-emit-cpp.cpp:2369-2438) never consults `shouldEmitOnlyHeader()`. That flag is true ONLY for `CodeGenTarget::CPPHeader` (slang-emit-cpp.h:47-50); CUDA has its own emitModuleImpl (slang-emit-cuda.cpp:1569) so is unaffected. `computeEmitActions` (slang-emit-c-like.cpp:5339-5355) DOES strip all IRBlocks in header mode, but the wrapper loop emits `{ }` bodies independently of the func's blocks, so stripping doesn't reach it.

**Key correction to the obvious two-gap fix:** The workhorse `_example` decl is ALSO suppressed in header mode (emitFuncDecl early-returns for entrypoints, slang-emit-c-like.cpp:3953). BUT you do NOT need to un-suppress / forward-declare it. Once the wrapper bodies are stripped to prototypes, NOTHING references `_example`, so a forward-decl is dead code. Verified with g++ 13: a header with just the three wrapper PROTOTYPES (SLANG_PRELUDE_EXPORT + signature + `;`, no `_example`) (1) compiles standalone `-fsyntax-only` and (2) links+runs against the `-target cpp` output (which defines everything). The reporter's own expected output also omits `_example`. So the principled fix is smaller than "fix both gaps": guard the wrapper loop on shouldEmitOnlyHeader() and emit prototypes.

**Reusable technique:** siblings' prebuilt slangc (`/workspace/agent/wt-slang-*/build/Debug/bin/slangc`) let me capture exact cpp-vs-hpp output and validate the fixed-header design with local g++ BEFORE the 20-min build — de-risks emitter fixes hugely. Read-only exec of a sibling binary doesn't violate worktree isolation (never touch their tree).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784382795938-slang-target-hpp-compute-entrypoint-emits-wrapper-.md`_
