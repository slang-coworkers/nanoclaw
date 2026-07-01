---
title: "Testing slang-llvm version-skew diagnostics + Slang worktree/build env gotchas"
type: learning
topic: slang-compiler
source: learnings/1780324487740-testing-slang-llvm-version-skew-diagnostics-slang-.md
---

# Testing slang-llvm version-skew diagnostics + Slang worktree/build env gotchas

From fixing shader-slang/slang#11388 (diagnostic E00109 for missing `createLLVMBuilder_V3`).

**Diagnostics that fire only on a runtime-library skew can't use a `.slang` DIAGNOSTIC_TEST.**
The `createLLVMBuilder_V3` null path only triggers when the loaded `libslang-llvm.so` lacks the symbol. In a from-source build the local prebuilt *exports* it, so a `.slang` test compiling to `-target ll` would SUCCEED and FileCheck would FAIL in CI — committing such a test breaks CI. Instead, write a **C++ unit test** that installs a shim via `IGlobalSession::setSharedLibraryLoader`: wrap the real `slang-llvm` and override `findSymbolAddressByName` to return null for just that symbol. Environment-independent (works whether the real lib is V2 or V3). Use a **fresh** `slang::createGlobalSession` so the session's cached `m_slangLLVM` doesn't bypass your loader. Model the COM shim on `DefaultSharedLibrary` (ComBaseObject + `SLANG_COM_BASE_IUNKNOWN_ALL`, born-at-0 refcount, `*out = wrapper.detach()` to transfer the ref). Note `getSharedLibraryLoader()` returns nullptr for the default singleton — base your shim on `DefaultSharedLibraryLoader::getSingleton()` directly. Target `SLANG_SHADER_LLVM_IR` (`-target ll`) reliably routes through `LLVMEmitter::init` (slang-emit.cpp `emitLLVMForEntryPoints`).

**The #11388 P1 self-healed:** the published slang-llvm prebuilt the build fetches (release 2026.10) already exports `createLLVMBuilder_V3` (nm-confirmed), so the build break is gone; the diagnostic PR is now hardening only. Always `nm -D -C build/slang-*/lib/libslang-llvm.so | grep createLLVMBuilder` to check the actual fetched version.

**Adding a diagnostic now = edit `source/slang/slang-diagnostics.lua`** (Lua-defined, FIDDLE-generated). `err("kebab-name", <id>, "msg with ~param")`; C++ struct name is word-by-word Title-case (`incompatible-slang-llvm-library` → `IncompatibleSlangLlvmLibrary`); a plain `~param` becomes a `String` member set via `.param = UnownedStringSlice(...)`. Next free normal id was 109 (cluster maxed at 108).

**Env gotchas:** a freshly-`git worktree add`ed Slang worktree needs `git submodule update --init --recursive` before `cmake --preset default` (else configure dies on `SPIRV-Headers::SPIRV-Headers` non-existent target). `clang-format` is absent — install matching version with `pip install --break-system-packages --user "clang-format>=17,<19"` (gets 18.1.8 in ~/.local/bin) and put it on PATH for `extras/formatting.sh`. The bot pushes `fix/issue-<n>` branches to **origin** (shader-slang/slang), not a personal fork; default base branch is **master** (not main).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780324487740-testing-slang-llvm-version-skew-diagnostics-slang-.md`_
