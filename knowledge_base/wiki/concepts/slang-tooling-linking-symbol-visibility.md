---
title: "Linking and Symbol Visibility"
type: concept
group: slang-tooling
tags: [linker, version-script, symbol-visibility, exports, elf, mach-o, dylib, nm, readelf, cmake, check-linker-flag, glslang, libstdcxx-leak, exclude-libs, lto, abi]
source_count: 10
---

# Linking and Symbol Visibility

Controlling and measuring a shared library's exported-symbol set: GNU ld version scripts (allow-lists vs prefix wildcards, what they can and cannot hide, ABI impact), the CMake `check_linker_flag` trap, and reading ELF or Mach-O export tables from a Linux container. Origin: shader-slang/slang#9146 / PR #12379 (`libslang-glslang` re-exporting libstdc++ internals), but the rules are about **where a guarantee rests** and **whether an instrument's population matches the claim**. Also covered: Slang's COM-interface ABI rules, and the *other* linking — module link-time specialization via `extern`/`export` and whether a `#if` scheme can migrate to it.

## TL;DR

- **A `global:` clause is an allow-list — enumerate names, never match a prefix.** A pattern's scope is every symbol reaching the linker (your TU + every pulled-in archive member); grepping your own source cannot enumerate *what else matches*. Check `nm --defined-only <dep>.a | grep -E ' [TW] <prefix>_'` first.
- **Ask what your guard's correctness rests on. If the answer is the thing you are fixing, it is the wrong guard.**
- **Find every consumer**: grep all `dlsym`/`findFuncByName` sites before claiming an interface is covered — an omitted name in a `dlopen`ed module fails at runtime, not at build.
- **A `global:` name absent from the link is silent** (exit 0); only a *malformed or missing* map is a hard error.
- **A version script cannot resurrect an `STV_HIDDEN` symbol.** An anonymous block (`{...};`) adds 0 VERDEF — no ABI break; a *named* node is an observable ABI change.
- **`-fvisibility=hidden` DOES hide `std::` instantiations your TU emits implicitly**; it cannot override an *explicit* attribute (libstdc++'s `namespace std _GLIBCXX_VISIBILITY(default)`).
- **`--exclude-libs,ALL` survives LTO** (GCC 12.2 / binutils 2.40) — the "LTO dissolves the archive boundary" story did not reproduce.
- **`check_linker_flag` with a version script probes the MAP's contents, not option support** — its trivial `main` defines none of the mapped names, so a strict linker drops the flag with no warning, and the negative is cached per path with no content hash.
- **Always `rm` the artifact, force the relink, measure, then check its mtime** — a linker-flag change touches nothing an object depends on.
- **Confirm your flag is literally on the command line** before trusting any probe result.
- **Mach-O exports are measurable on Linux with stdlib Python** — dyld export trie + `LC_SYMTAB` nlist; two independent structures make agreement a real control.
- **Classify symbol ownership on the MANGLED name** (`_ZNSt`, `_ZSt`, `_ZNKSt`, `_ZTISt`/`_ZTVSt`/`_ZTSSt`/`_ZGVNSt`); `c++filt` prints the return type first, so demangle for display only.
- **"Mentions `std::`" ≠ "is a `std::` symbol"** (548 vs 1 on one dylib); a namespace-token predicate is blind to C typedefs (`spv_message_level_t`).
- **A parser returning a plausible number is worthless** without *must-differ*, *guilty*, and *partition* controls.
- **The single check behind every error in this family: what exactly did I count, and is it the set my sentence is about?**
- **Slang link-time specialization gates VALUES and PRESENCE, not program SHAPE**: constants, loop bounds, `Conditional<T,bool>` fields and resource bindings, `extern struct` type substitution — yes; `struct`/function declarations (`E20001`), `import`s, entry-point signatures — no. A `#if` scheme migrates only if its permutations are values/presence.
- **Precompilation is INDEPENDENT of specialization** — precompile once offline, specialize per variant at link time. Link-time-constant array sizes are WIP (`E31010`).
- **Deprecating a public COM-interface method is ABI/source-safe (`pr: non-breaking`)**; `-Wdeprecated-declarations` fires only on *uses* — wrap call sites in `SLANG_ALLOW_DEPRECATED_BEGIN/_END`.
- **Never add a method to the internal `IDownstreamCompiler` vtable** (the default build calls a prebuilt older `slang-llvm` through it) — use a standalone `castAs` extension interface (own UUID, no `ISlangUnknown` base, served from `getObject()`); errors here are CI-only.
- **Retyping a public generic value parameter int→enum is a `pr: breaking change`** (no implicit int→enum → `E30019` at downstream import); fix downstream in a companion PR.
- **An anonymous-namespace symbol has internal linkage regardless of `static`** — to expose it to `slang-static-unit-test`, move it to `namespace Slang` scope and declare it in the header.

## Version scripts: enumerate names, never match a prefix

The obvious script for nine `glslang_*` exports was `{ global: glslang_*; local: *; }`. It was wrong: upstream glslang defines **41 `glslang_*` C-API symbols of its own**, and the wildcard allow-listed those too. With the archive member forced in (`--whole-archive`, no `--exclude-libs`): `global: glslang_*` → **50 exports, 41 upstream leaked**; the 9 names listed → **9, 0**. The 41 stayed out of the shipping build only because `glslang_c_interface.cpp.o` is never extracted — **export correctness rested on `--exclude-libs`, the exact mechanism whose failure the issue was about.** Grepping `slang-glslang.cpp` for `extern "C"` gave a correct count (9) attached to a sentence about a different set; `nm` of the dependency archives would have shown 41. ⇒ Prefer an explicit allow-list for any exported-symbol boundary — auditable and provenance-independent, where a wildcard silently inherits whatever your dependencies name themselves ([a version-script allow-list must LIST names](../learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md), [a wildcard export pattern's scope is the whole link](../learnings/1785985481291-a-wildcard-export-pattern-s-scope-is-the-whole-lin.md)).

Two review corollaries. **When a dispatch supplies both a mechanism and supporting data, hedge the mechanism** — here the hedge covered the (cheap, correct) list while the wrong wildcard recommendation was stated as fact. **Grep every loader before claiming coverage**: this module had two (`source/compiler-core/slang-glslang-compiler.cpp:91-102`, `tools/gfx/vulkan/glslang-module.cpp:54-56`) and prior memos named only the first; sweep with `grep -rhoE '"<prefix>_[A-Za-z0-9_]+"' source/ tools/ examples/` ([a wildcard export pattern's scope is the whole link](../learnings/1785985481291-a-wildcard-export-pattern-s-scope-is-the-whole-lin.md)).

## What a version script can and cannot do

All measured on GCC 12.2 / binutils 2.40 ([a version-script allow-list must LIST names](../learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md)):

- **No resurrection of `STV_HIDDEN`.** With a control object holding one hidden and one default function sharing the prefix, only the default one exports; the hidden one stays `t`. A script cannot undo `-fvisibility=hidden`.
- **Anonymous block = 0 VERDEF** → no symbol versioning, `dlsym("name")` unaffected. Check `readelf -d <so> | grep -c VERDEF` before and after (0 both times).
- **`-fvisibility=hidden` hides implicit `std::` instantiations** (measured `WEAK HIDDEN`); the blanket "hidden visibility can't hide `std::`" is FALSE — only an explicit attribute (which tags the out-of-line `basic_string::_M_*` helpers) wins.
- **`--exclude-libs,ALL` survives LTO**: with the dependency archive forced to GIMPLE bytecode (138 `.gnu.lto` sections vs 0 stock), everything was still localized.
- **`#` comments are valid** in GNU ld and gold version scripts; **lld accepts only `/* */`.**
- **Omissions are silent; malformations are loud.** The map listed `glslang_compile_1_3`, a stale `.o` lacked it → 8 exports, exit 0; a bad or missing map is `syntax error in VERSION script` / `cannot open linker script file`. In this module a dropped name is a crash, not a build error: `GlslangDownstreamCompiler::init` fails only when all four `m_compile_*` are null, and `m_link` is dereferenced unguarded (`slang-glslang-compiler.cpp:426`) ([check_linker_flag probes the map's contents](../learnings/1785987788952-check-linker-flag-with-a-version-script-probes-the.md)).

**Stale-artifact trap.** CMake needs `set_property(TARGET t APPEND PROPERTY LINK_DEPENDS <abs path>)` or editing the script will not relink — and `LINK_DEPENDS` does not relink a binary built before the flag existed. A "9 exports / 0 `std::`" success was nearly reported until `stat` showed the `.so` predated the edit by 13 minutes. ⇒ `rm` the artifact, force the relink, measure, check the mtime ([a version-script allow-list must LIST names](../learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md)).

## check_linker_flag probes the map's contents — and caches the negative

Slang's `add_supported_cxx_linker_flags` (`cmake/CompilerFlags.cmake:47-83`) applies a flag only `if(${test_name})` after `check_linker_flag`, with no `else()`. For a version script, the probe links a trivial `int main(){}` defining **none** of the mapped `global:` names, so under a linker that rejects undefined versions (`-Wl,--no-undefined-version`) it fails on the map's own contents (`ld: glslang_validateSPIRV: undefined version:` …). Measured: probe → exit 1 → flag DROPPED, no warning; the real target under the identical linker → exit 0, 9 exports, 0 `std::`. The hardening silently reverts with a green build. No exotic toolchain is needed: `LDFLAGS` at first configure seeds `CMAKE_EXE_LINKER_FLAGS`, `try_compile` inherits it, and Slang's `emscripten` preset already sets it.

**The negative is sticky.** `${test_name}` is a cache variable keyed on the absolute path with no content hash, so one bad probe permanently disables the hardening in that tree and editing the `.map` never re-probes. Control: reused tree + permissive linker + valid map → `HAVE_VS=''` (`HAVE_VS:INTERNAL=` in `CMakeCache.txt`); fresh tree, same inputs → `HAVE_VS='1'`. Tested remedies: read the cache var after the call and `message(WARNING/FATAL_ERROR)` on a drop, or probe a path-free form (`--version-script=/dev/null`) and apply the real flag via `target_link_options`.

**Confirm the flag is on the command line you think it is.** Proving the flag reached the probe via `CMAKE_REQUIRED_LINK_OPTIONS` gave a FALSE PASS (`check_linker_flag` overwrites it); only `grep -c no-undefined-version CMakeError.log` = 1 was sound. Coverage claims need per-symbol scoping too: `slang-emit.cpp:3379` gates the glslang link path on `spirvFiles.getCount() > 1`, so the 146 `-emit-spirv-via-glsl` tests never reach `glslang_linkSPIRV` — the one name whose omission crashes ([check_linker_flag probes the map's contents](../learnings/1785987788952-check-linker-flag-with-a-version-script-probes-the.md)).

## Measuring the export set: ELF, and Mach-O with no Apple tooling

ELF exports are `nm -D --defined-only --extern-only`. The full `.symtab` additionally shows symbols **present but LOCAL** (lowercase `t`/`d`/`r`/`b`) — 7501 names present with zero global binding is how you *show* a localization worked. To tell "a version script was used" from other localization, check `readelf -S | grep gnu.version_d` (`.gnu.version` is a different section — needed-version imports — present on almost everything).

A macOS `.dylib` is measurable exactly from Linux: binutils `nm`/`objdump` cannot read Mach-O, but that is a missing binary, not an unmeasurable format. Two structures, written by different linker paths, each ~60 lines of stdlib Python:

- **`LC_DYLD_EXPORTS_TRIE`** (or `LC_DYLD_INFO_ONLY.export_off`) — the dyld export trie, authoritative for `dlopen`/`dlsym`.
- **`LC_SYMTAB`** nlist, filtered `N_EXT && !N_PEXT && N_TYPE in {N_SECT, N_ABS}`, skipping `N_STAB` — an independent control. It omits `N_INDR` (re-exports), so measure `N_INDR` = 0 before claiming the two must agree.

Parser: `/workspace/agent/tools/machexp.py` (fat binaries via `FAT_MAGIC`; uleb128 trie). **Three controls**: *must-differ* — a spread across one package's dylibs (2 / 226 / 621 / 1563 / 3860 / 58801) kills a constant-returning parser; *guilty* — truncated/garbage input must fail loudly (`not a 64-bit little-endian Mach-O (magic=0x41414141)`), never return a count; *partition* — buckets must sum to the file total (this caught a 47-symbol shortfall in a handed-over figure).

**Demangling traps** ([reading Mach-O exports with no Apple tooling](../learnings/1785991525886-reading-mach-o-exports-with-no-apple-tooling-two-i.md)):

1. **`c++filt` prints the RETURN TYPE FIRST**, so `^std::` matches `std::__1::basic_string<...> spvtools::val::Instruction::GetOperandAs<...>(unsigned long) const`, owned by `spvtools::val`. Classify on the mangled `St` substitution at name position 0.
2. **"Mentions `std::`" ≠ "is a `std::` symbol."** Naive `grep std::` = 548, `grep basic_string` = 150, symbols whose owning entity was in `std::` = **1**; the rest were third-party functions taking `std::vector` — conflating them inverts the leak conclusion.
3. **Namespace tokens miss C typedefs**: filtering on `spvtools|glslang|spv::` misfiled `spv_message_level_t`/`spv_position_t` RTTI as stdlib. Widen to the C prefix (`\bspv_[a-z]`) or read the header. Use exact mangled names, never a loose regex.

## The single generator behind this family of errors

One task produced **six** measurement/claim errors, self-caught only twice; all had one shape — **an instrument whose filter or population did not match the claim, yielding a well-formed number**. Examples: `grep 'basic_string.*_M_replace('` matched a `pool_allocator` instantiation (phantom "4 hits"); `.localalias` as an LTO fingerprint was in both binaries (95 vs 97); `ninja -t commands` includes transitive deps ("248 glslang TUs" = 48 glslang + 200 SPIRV-Tools); a `GLOBAL DEFAULT` filter over `WEAK DEFAULT` symbols gave a pure-artifact "0". In a Multi-Config tree **the default `build.ninja` answers for DEBUG** — it reported 0 `-flto`; use `ninja -f build-Release.ninja -t commands <target>`, and look for link edges in `CMakeFiles/impl-<cfg>.ninja`. Practices that caught errors: a **positive control** beside every count (a 0 control means an invalid target, not a negative); a negative control that **discriminates both ways**; exact mangled names; and when a number is fixed in one document, grep the pattern across all of them ([a version-script allow-list must LIST names](../learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md)). The counter-error had the opposite sign — an instrument *narrower* than the claim (one source file for a whole-link pattern); the same question catches both ([a wildcard export pattern's scope is the whole link](../learnings/1785985481291-a-wildcard-export-pattern-s-scope-is-the-whole-lin.md)).

## The other linking: Slang module link-time specialization, and the `#if` boundary

Slang's module linking resolves `extern static const int kFoo;` in one module against `export static const int kFoo = 2;` in another (`docs/user-guide/10-link-time-specialization.md`). The question arises whenever someone wants to retire `#if` specialization to ship precompiled `.slang-module` binaries (shader-slang/slang#12313); the boundary below was verified at `88fa1206d` from source/docs/tests plus a compiled A/B/C matrix ([link-time specialization gates fields and bindings, not declarations](../learnings/1786081900425-slang-link-time-specialization-can-gate-struct-fie.md)).

- **Can:** values, loop bounds, algorithm selection (`extern static const` + DCE); **struct field presence** via `Conditional<T, bool>` (`slang-ir-lower-conditional-type.h:12-13` rewrites `Conditional<T,true>`→`T`, `false`→empty struct); **resource-binding presence** — a `Conditional<RWTexture2D<uint>, kFeature=false>` is absent from emitted SPIR-V while the ungated control appears 6× (`tests/spirv/conditional-resource-link-time-spec-const.slang`); **type substitution** — `extern struct S : ISampler;` + `export struct S : ISampler = Impl;`.
- **Cannot:** gate a function/`struct` declaration (`error[E20001] unexpected token`, while the same `#if` gating compiles — checked against that positive control); gate `import`s or module structure; change an entry-point signature beyond `Conditional<>` optionality. Link-time-constant array sizes are WIP (`E31010`: "some aspects of the reflection API may not work").
- **Decision rule:** values/features/fields/bindings migrate; conditionally-declared functions, types, or `import` sets need refactoring toward `Conditional<>` and interface substitution, not mechanical translation.
- **Precompilation is independent of specialization** (`10-link-time-specialization.md:25-30`): modules precompile to binary IR offline with no specialization arguments, and link time reuses that work — so it answers permutation blowup rather than restating it. Whether a specific shader corpus fits is empirical and belongs to its owner: publish the boundary, ask, don't assert.

## Public COM-interface ABI: deprecation, extension interfaces, and the enum-param trap

Slang's COM-style vtables (`include/slang.h` and internal interfaces) have layout fixed by declaration order (the CLAUDE.md "Modifying Public Headers" rules).

**Deprecating a public method (the `createCompileRequest` precedent, #7982 `addBuiltins`).** Copy the precedent on the same interface: `[[deprecated]]` (or `SLANG_DEPRECATED`, gated by `SLANG_NO_DEPRECATION`) leaves signature, order, and vtable slot unchanged → `pr: non-breaking`. `-Wdeprecated-declarations` fires on a *use* (call or address-of), not on overrides, so `Session::` impls, the vtable-stability mock, and `REPLAY_UNIMPLEMENTED_X` proxy overrides need no change; wrap the real call sites (for `addBuiltins`, only `spAddBuiltins`) in `SLANG_ALLOW_DEPRECATED_BEGIN/_END` (`source/core/slang-common.h:311`), found by grepping `->method`/`.method` across source/include/tools/examples. A phased deprecation uses `Refs #N`, not `Fixes`; verification is a clean `-Werror` build ([deprecating a public COM-interface method](../learnings/1787079451132-deprecating-a-public-com-interface-method-in-slang.md)).

**A capability on an internal COM object → a `castAs` extension interface (#12838).** `IDownstreamCompiler` (`slang-downstream-compiler.h`) is a cross-binary contract: the default build (`FETCH_BINARY_IF_POSSIBLE`) downloads an older-release `slang-llvm` and calls its `LLVMDownstreamCompiler` through that vtable (`createLLVMDownstreamCompiler_V4`), so any new virtual — even appended — is a wild call into an old object (`cmake/sanitizer-ignorelist.txt` lists `type:*IDownstreamCompiler*` under `[vptr]` for this reason). Editing `slang-llvm.cpp` does not help; it is not compiled by default. PR #11556's `getDownstreamCompilerVersion` only read `getDesc().version`, so cloning it for a path getter is the trap. Safe pattern: a separate interface with its own UUID (`IDownstreamCompilerPathProvider::getPath`), multiply inherited by `DownstreamCompilerBase` defaulting to `SLANG_E_NOT_AVAILABLE`; an old binary returns null for the unknown UUID. The public `IGlobalSession::getDownstreamCompilerPath` is a separate append-only slot and fine ([IDownstreamCompiler capability crosses the prebuilt slang-llvm ABI](../learnings/1788074617370-adding-a-capability-to-idownstreamcompiler-crosses.md)). Two traps building it (PR #12841): (1) don't derive `ICastable`/`ISlangUnknown` — a second `ISlangUnknown` subobject makes `ComPtr<LLVMDownstreamCompiler>` fail with `'ISlangUnknown' is an ambiguous base`; make it standalone (`SLANG_COM_INTERFACE(...)` + the method), since `as<T>` only needs `T::getTypeGuid()`. (2) Serve it from `getObject()`, not `getInterface()`: `castAs = getInterface ?? getObject`, and `queryInterface` addRefs via `getInterface`, handing out an unreleasable ref. This class is CI-only (local presets never compile `slang-llvm.cpp`); validate with a tiny repro including the real headers + `ComPtr<Concrete>` ([castAs capability interface: standalone + getObject](../learnings/1788289363595-adding-a-castas-capability-interface-to-a-downstre.md)).

**Retyping a public generic value parameter int→enum is breaking (#12840).** Retyping `matrix<T,R,C,L>`'s `L` from `int` to `MatrixLayoutMode` breaks downstream generic extensions declared with `int` at front-end import (`error[E30019]: type mismatch ... expected 'MatrixLayoutMode', got 'int'`) — Slang does no implicit int→enum for generic value args. It surfaces as the "SlangPy Tests" `repository_dispatch` job building slangpy's default branch against the PR (`gh run view <id> -R shader-slang/slangpy --log-failed`). Fix downstream (`let L : MatrixLayoutMode`) in a companion slangpy PR; the check stays red on the slang PR until slangpy lands, so merge slang with it acknowledged. Legit `pr: breaking change`; this is an import break, not a codegen layout concern ([int→enum public-param retype breaks downstream](../learnings/1788455543019-slang-int-enum-public-param-retype-breaks-downstre.md)).

**Exposing a `source/slang` internal to `slang-static-unit-test`.** Many `slang-ir-*.cpp` files wrap all file-local helpers in one anonymous namespace, which gives internal linkage regardless of `static` — "drop the `static`" is insufficient. Move the definition to `namespace Slang` scope (after `} // anonymous namespace`, where the public entry points live), drop `static`, declare it in the header; it can still call the anon-ns helpers. The STATIC target exists only with `-DSLANG_LIB_TYPE=STATIC -DSLANG_ENABLE_SLANG_RHI=ON -DSLANG_ENABLE_TESTS=ON`, and new `tools/slang-static-unit-test/*.cpp` are auto-globbed — no CMake edit ([exposing an internal: check the anonymous namespace](../learnings/1789225246267-exposing-a-source-slang-internal-for-slang-static-.md)).

---
**Source learnings (10):**
- [Exposing an internal: anon-namespace linkage beats dropping static](../learnings/1789225246267-exposing-a-source-slang-internal-for-slang-static-.md)
- [Version-script allow-list must LIST names; what scripts can't hide](../learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md)
- [Wildcard export pattern's scope is the whole link (50/41 vs 9/0)](../learnings/1785985481291-a-wildcard-export-pattern-s-scope-is-the-whole-lin.md)
- [check_linker_flag probes the map's contents; caches the negative](../learnings/1785987788952-check-linker-flag-with-a-version-script-probes-the.md)
- [Reading Mach-O exports with no Apple tooling; demangle traps](../learnings/1785991525886-reading-mach-o-exports-with-no-apple-tooling-two-i.md)
- [Link-time specialization gates fields/bindings, not decls/imports](../learnings/1786081900425-slang-link-time-specialization-can-gate-struct-fie.md)
- [Deprecating a public COM method: createCompileRequest pattern](../learnings/1787079451132-deprecating-a-public-com-interface-method-in-slang.md)
- [IDownstreamCompiler capability: castAs interface, not vtable slot](../learnings/1788074617370-adding-a-capability-to-idownstreamcompiler-crosses.md)
- [castAs capability interface: standalone, served from getObject](../learnings/1788289363595-adding-a-castas-capability-interface-to-a-downstre.md)
- [int→enum public-param retype breaks downstream (E30019, #12840)](../learnings/1788455543019-slang-int-enum-public-param-retype-breaks-downstre.md)
_Catalog: [[wiki/index.md]]_
