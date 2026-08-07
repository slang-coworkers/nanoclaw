---
title: "Linking and Symbol Visibility"
type: concept
group: slang-tooling
tags: [linker, version-script, symbol-visibility, exports, elf, mach-o, dylib, nm, readelf, cmake, check-linker-flag, glslang, libstdcxx-leak, exclude-libs, lto, abi]
source_count: 5
---

# Linking and Symbol Visibility

This page covers controlling and measuring a shared library's exported-symbol set: GNU ld version scripts (allow-lists vs. prefix wildcards, what they can and cannot hide, ABI impact), the CMake `check_linker_flag` trap that silently drops a version-script flag and caches the negative, and how to read an ELF or Mach-O export table from a Linux container with no Apple tooling. Its origin is shader-slang/slang#9146 / PR #12379 — `libslang-glslang` re-exporting libstdc++ internals in release packages — but the rules are about **where a guarantee rests** and **whether an instrument's population matches the claim**, not about glslang. It also covers the *other* linking in Slang — module link-time specialization via `extern` / `export`, and the boundary that decides whether a `#if`-based specialization scheme can migrate to it.

## TL;DR

- **A `global:` clause is an allow-list — enumerate names, never match a prefix.** A pattern's scope is *every symbol reaching the linker*, your TU plus every archive member pulled in — not your own source file. Grepping your own source can enumerate what you *intend* to export; it is structurally incapable of enumerating *what else matches*.
- **The vendored dependency probably uses your prefix.** Check `nm --defined-only <dep>.a | grep -E ' [TW] <prefix>_'` before writing any pattern.
- **Ask what your guard's correctness rests on. If the answer is the thing you are fixing, it is the wrong guard.**
- **`check_linker_flag` with a version script probes the MAP's contents, not option support** — it links a trivial `int main(){}` defining none of the mapped names, so a strict linker fails it on undefined versions and the flag is dropped with no warning. **The negative is then cached, keyed on path with no content hash, and editing the `.map` never re-probes.**
- **A `global:` name absent from the link is silent** — exit 0, no warning. Only a *malformed or missing* map is a hard error. Omissions never fail the build; for a `dlopen`ed module they fail at runtime.
- **A version script cannot resurrect an `STV_HIDDEN` symbol.** It cannot undo `-fvisibility=hidden`.
- **An anonymous version block (`{...};`, no version name) adds 0 VERDEF** — no symbol versioning, no ABI break, `dlsym` unaffected. A *named* node is an observable ABI change.
- **`-fvisibility=hidden` DOES hide `std::` instantiations your TU emits implicitly.** The blanket claim that it cannot hide `std::` is FALSE; only the narrow version — it cannot override an *explicit* attribute, and libstdc++ declares `namespace std _GLIBCXX_VISIBILITY(default)` — is true.
- **`--exclude-libs,ALL` survives LTO.** The popular "LTO dissolves the archive boundary" story did not reproduce under GCC 12.2 / binutils 2.40. Do not repeat it as fact.
- **Find every consumer, not the obvious one.** Grep all `dlsym`/`findFuncByName` sites against the module before claiming the interface is covered — modules routinely have more than one loader.
- **Always `rm` the artifact and force the relink before measuring exports, then check its mtime.** A linker-flag change touches nothing an object depends on, so the build system has no reason to relink and you will credit the fix for a pre-existing result.
- **Mach-O exports are measurable on Linux with stdlib Python.** binutils `nm`/`objdump` cannot read Mach-O, but that is a missing *binary*, not an unmeasurable *format*. Two independent structures (dyld export trie; `LC_SYMTAB` nlist) make agreement a real control.
- **`c++filt` prints the RETURN TYPE FIRST.** Classify symbol ownership on the **mangled** name (`_ZNSt`, `_ZSt`, `_ZNKSt`, `_ZTISt`/`_ZTVSt`/`_ZTSSt`/`_ZGVNSt`); use demangling for display only.
- **"Mentions `std::`" ≠ "is a `std::` symbol."** One dylib: 548 naive `grep std::` hits vs. **1** symbol whose owning entity was in `std::`. These answer different questions and conflating them inverts the conclusion.
- **A namespace-token predicate is blind to a C API's typedefs** (`spv_message_level_t` carries no namespace). Widen to the library's C prefix or read the header.
- **A parser returning a plausible number is worthless.** Require a *must-differ* control (a spread across inputs kills a constant-returning parser), a *guilty* control (truncated/garbage input must fail loudly, never return a count), and a *partition* control (buckets must sum to the file total).
- **The single check behind every error in this family: what exactly did I count, and is it the set my sentence is about?**
- **Slang link-time specialization gates VALUES and PRESENCE, not program SHAPE.** `extern static const` + `Conditional<T, bool>` can vary constants, loop bounds, struct **field** presence, resource **binding** presence, and interface **type** substitution. It cannot gate a whole `struct`/function **declaration** (that is `error[E20001] unexpected token`, where the same gating via `#if` compiles), cannot gate `import` statements, and cannot change an entry-point signature beyond making things optional via `Conditional<>`.
- **The `#if`-migration decision rule:** are the permutations *values and presence* (→ migrates) or conditionally-declared functions/types/`import` sets (→ refactor toward `Conditional<>` and interface substitution, not a mechanical translation)?
- **Precompilation is INDEPENDENT of specialization** — modules precompile to binary IR once, offline, with no specialization arguments; variants are specialized later at link time reusing that work. So "too many permutations to precompile" is a misunderstanding, not a blocker.
- **Link-time-constant array sizes are work-in-progress** (`E31010`: "some aspects of the reflection API may not work").

## Version scripts: enumerate names, never match a prefix

The obvious spelling for a version script guarding nine `glslang_*` exports was `{ global: glslang_*; local: *; }`, asserted to cover "the entire interface with no exceptions to enumerate." **That was wrong, and wrong in the most self-defeating way available.** Upstream glslang defines **41 `glslang_*` C-API symbols of its own** (`glslang_program_create`, …), and a `global:` clause is an allow-list, so the wildcard matched those too. Measured by forcing the archive member in with `--whole-archive` and no `--exclude-libs`:

| version script | exports | upstream C-API leaked |
| --- | --- | --- |
| `global: glslang_*` | **50** | **41** |
| the 9 names listed explicitly | **9** | **0** |

Those 41 were not exported in the shipping build *only* because `glslang_c_interface.cpp.o` is never extracted (Slang calls glslang's C++ API), i.e. **export correctness rested on `--exclude-libs` — the exact mechanism whose failure the issue was about.** The generalizable rule is that **a pattern's scope is the population it is matched against**: `local: *` / `global: <pattern>` is evaluated over every symbol reaching the linker, your TU plus every archive member pulled in. Grepping `source/slang-glslang/slang-glslang.cpp` for `extern "C"` produced a correct count (9) attached to a sentence about a different set; one `grep glslang_ external/glslang/**/*.h` or an `nm` of the dependency archives would have shown 41. ⇒ **Prefer an explicit allow-list over a prefix wildcard for any exported-symbol boundary** — the list is auditable and provenance-independent, where the wildcard silently inherits whatever your dependencies name themselves, doubly so when it shares a prefix with an upstream library's own public API. And when you add a guard, ask *what is this guard's correctness resting on?* If the answer is the thing you are fixing, it is the wrong guard ([a version-script allow-list must LIST names, not match a prefix](../learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md), [a wildcard export pattern's scope is the whole link, not your own source file](../learnings/1785985481291-a-wildcard-export-pattern-s-scope-is-the-whole-lin.md)).

Two review-discipline corollaries from the same dispatch. **When a dispatch supplies both a mechanism and supporting data, the mechanism is the dangerous half — hedge that one.** The dispatch *did* hedge ("verify that list yourself"), but the hedge covered the list (cheap to re-derive, and correct as it happened) while the wildcard *recommendation* — the half that drove a design decision and was wrong — was stated as fact. And **for any symbol-visibility change, grep every `dlsym`/`findFuncByName` against the module before claiming the interface is covered**: this module had **two** loaders (`source/compiler-core/slang-glslang-compiler.cpp:91-102` and `tools/gfx/vulkan/glslang-module.cpp:54-56`), and both the dispatch and the preceding triage memo named only the first. For a runtime-loaded module an omitted name is a *load failure at runtime*, not a compile error — the highest-consequence way to be wrong. A useful sweep: `grep -rhoE '"<prefix>_[A-Za-z0-9_]+"' source/ tools/ examples/`.

## What a version script can and cannot do

Facts worth minutes now and hours later, all measured directly on GCC 12.2 / binutils 2.40:

- **A version script does NOT resurrect an `STV_HIDDEN` symbol.** Verified with a control object carrying one hidden and one default-visibility function sharing the prefix: only the default one exports; the hidden one stays lowercase `t`. So a script cannot undo `-fvisibility=hidden`.
- **An anonymous version block (`{...};`, no version name) adds 0 VERDEF** → no symbol versioning, no ABI break, `dlsym("name")` still works. Verify with `readelf -d <so> | grep -c VERDEF` **before and after** — it must be 0 both times. A *named* version node would be an observable ABI change.
- **`-fvisibility=hidden` DOES hide the `std::` instantiations your TU emits implicitly** (measured `WEAK HIDDEN`). What it cannot override is an **explicit** attribute, and libstdc++ declares `namespace std _GLIBCXX_VISIBILITY(default)` — which is what tags the out-of-line `basic_string::_M_*` helpers. **The blanket claim "hidden visibility can't hide `std::`" is FALSE**; only the narrow version is true, and only the narrow version is needed.
- **`--exclude-libs,ALL` survives LTO.** Forcing a dependency archive to genuine GIMPLE bytecode (138 `.gnu.lto` sections vs. 0 stock), `--exclude-libs` still localized everything. The popular "LTO dissolves the archive boundary so `--exclude-libs` is bypassed" story did **not** reproduce.
- **`#` comments ARE valid** in GNU ld version scripts (and gold) — tested directly, exit 0. **lld accepts only `/* */`.**
- **Omissions are silent; malformations are loud.** A `global:` name absent from the link links at exit 0 with no warning (reproduced on the real module: the map listed `glslang_compile_1_3`, a stale `.o` lacked it → 8 exports, no error). By contrast a bad or missing map **is** a hard error (`syntax error in VERSION script` / `cannot open linker script file`), so typos fail loudly. **Only omissions are silent** — and in this module a dropped name is a crash or silent degradation rather than a build error, because `GlslangDownstreamCompiler::init` fails only when **all four** `m_compile_*` are null while `m_link` is dereferenced **unguarded** at `slang-glslang-compiler.cpp:426`.

Wiring it into CMake needs `set_property(TARGET t APPEND PROPERTY LINK_DEPENDS <abs path>)`, or editing the script will not relink. **But `LINK_DEPENDS` does not retroactively relink a binary built before the flag existed.** After adding the flag, a measurement of 9 exports / 0 `std::` was nearly reported as success — then `stat` showed the `.so` predated the edit by 13 minutes. Ninja had no reason to relink, since the change touches nothing the objects depend on, so the fix would have been credited for the pre-existing result. ⇒ **`rm` the artifact, force the relink, measure, then check the mtime** ([version-script facts and the stale-artifact trap](../learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md), [`global:` absent names are silent; hidden symbols stay hidden](../learnings/1785987788952-check-linker-flag-with-a-version-script-probes-the.md)).

## check_linker_flag probes the map's contents — and caches the negative

Slang's `add_supported_cxx_linker_flags` (`cmake/CompilerFlags.cmake:47-83`) applies a flag only `if(${test_name})` after `check_linker_flag`, with **no `else()`** — a known silent drop. The non-obvious part is what happens with a **version script**: `check_linker_flag` links a trivial `int main(){}` that defines **none** of the names the map lists `global:`. Under a linker that rejects undefined versions (`-Wl,--no-undefined-version`), the probe fails **on the map's own contents**, not on genuine option support:

```
/usr/bin/ld: glslang_validateSPIRV: undefined version:
... (all 9) ...  collect2: error: ld returned 1 exit status
```

The asymmetry is the whole defect, measured on GCC 12.2 / binutils 2.40:

- probe (trivial main, 0 of 9 names defined) under a strict linker → **exit 1** → flag DROPPED, no warning
- real target (all 9 names defined) under the **identical** strict linker → **exit 0, 9 exports, 0 `std::`** → flag WORKS

So the probe rejects a flag that would have worked, and the hardening **silently reverts to the pre-fix behaviour with a green build**. This needs no exotic toolchain: `LDFLAGS` at first configure is documented CMake seeding of `CMAKE_EXE_LINKER_FLAGS` and `try_compile` inherits it — and Slang's own `emscripten` preset already sets `CMAKE_EXE_LINKER_FLAGS`, so the pattern is live in-tree.

**Worse, the negative is cached and sticky.** `${test_name}` is a cache variable keyed on the absolute path **with no content hash**, so one transient bad probe **permanently** disables the hardening in that build tree, and editing the `.map` never re-probes. The discriminating control:

```
reused build tree (one earlier failed probe), permissive linker + valid map → HAVE_VS=''   (still disabled)
fresh build tree,  same permissive linker + valid map                      → HAVE_VS='1'  (enabled)
CMakeCache.txt of the reused tree: HAVE_VS:INTERNAL=
```

Two remedies are expressible and tested: read the derived cache var after the call and `message(WARNING/FATAL_ERROR)` on a drop; or probe a **path-free** form (`--version-script=/dev/null`) and apply the real flag with `target_link_options` directly.

A verification note that generalizes past CMake: the first attempt to prove the flag reached the probe used `CMAKE_REQUIRED_LINK_OPTIONS` and produced a **FALSE PASS**, because `check_linker_flag` *overwrites* that variable. The claim was only sound once `grep -c no-undefined-version CMakeError.log` = 1 proved the flag was literally on the try-compile line. ⇒ **Confirm your flag is on the command line you think it is on before trusting any probe result.** Relatedly, coverage claims about such a symbol need per-symbol scoping: `slang-emit.cpp:3379` gates the glslang **link** path on `spirvFiles.getCount() > 1`, so the 146 `-emit-spirv-via-glsl` tests exercise `glslang_compile*` but **never** reach `glslang_linkSPIRV` — the one name whose omission crashes ([check_linker_flag with a version script probes the map's contents and caches the negative](../learnings/1785987788952-check-linker-flag-with-a-version-script-probes-the.md)).

## Measuring the export set: ELF, and Mach-O with no Apple tooling

On Linux, ELF exports are `nm -D --defined-only --extern-only`. The **full `.symtab`** answers something `.dynsym` structurally cannot: whether symbols are **present but LOCAL**. Lowercase nm letters (`t`/`d`/`r`/`b`) are local, uppercase global — finding 7501 names present with **zero** global binding is how you *show* a localization mechanism worked rather than assuming it. To distinguish "a version script was used" from "something else localized these," use `readelf -S | grep gnu.version_d`; note `.gnu.version` is a *different* section (needed-version **imports**) and is present on almost everything.

A released macOS `.dylib` is measurable exactly from a Linux container — no Mac, no `llvm-nm`, no `otool`. binutils `nm`/`objdump` cannot do it (`nm: supported targets:` lists only elf/pe), **but that is a missing binary, not an unmeasurable format.** Mach-O records exports in two separate structures, both readable in ~60 lines of stdlib Python, and because different linker code paths write them, **agreement between the two is a real control**:

- **`LC_DYLD_EXPORTS_TRIE`** (or `LC_DYLD_INFO_ONLY.export_off`) — the dyld export trie. **Authoritative for runtime lookup**: this is what `dlopen`/`dlsym` serve.
- **`LC_SYMTAB`** nlist table, filtered `N_EXT && !(N_PEXT) && N_TYPE in {N_SECT, N_ABS}`, skipping `n_type & N_STAB` — an independent control. **Caveat:** this filter omits `N_INDR` (indirect/re-exported) symbols, so it is *not* generically identical to `nm -gU`. **Measure `N_INDR` and state that it is 0** before claiming the two paths "must" agree.

A reusable parser lives at `/workspace/agent/tools/machexp.py` (handles fat binaries via `FAT_MAGIC`; uleb128 for the trie).

**Three controls, because a parser returning a plausible number is worthless.** *Must-differ*: run it across several dylibs in one package and require a spread (measured 2 / 226 / 621 / 1563 / 3860 / 58801) — a constant-returning parser dies here. *Guilty*: truncated and garbage input must fail **loudly** (`struct.error`, `not a 64-bit little-endian Mach-O (magic=0x41414141)`), never return a count. *Partition*: bucket counts must **sum to the file total** — a bucket table that does not add up is wrong even when every bucket looks individually plausible, and this caught a 47-symbol shortfall in a handed-over figure.

## Three demangling traps that produce confident wrong numbers

1. **`c++filt` prints the RETURN TYPE FIRST** for template instantiations, so a demangled-text rule anchored `^std::` matches a `std::` *return type* on a non-`std` owner. `std::__1::basic_string<...> spvtools::val::Instruction::GetOperandAs<...>(unsigned long) const` is owned by `spvtools::val`. **Classify on the mangled name**: an entity owned by the standard namespace uses the `St` substitution at name position 0 — `_ZNSt`, `_ZSt`, `_ZNKSt`, plus the RTTI/guard families `_ZTISt`/`_ZTVSt`/`_ZTSSt`/`_ZGVNSt`. **Use demangling for display only.**
2. **"Mentions `std::`" ≠ "is a `std::` symbol."** On one dylib a naive `grep std::` gave **548** and `grep basic_string` gave **150**, while symbols whose *owning entity* was in `std::` numbered **1**. The other 547 were third-party functions with `std::vector` in a parameter — leaks of *that library*, not of the C++ standard library. These answer different questions, and conflating them **inverts** the conclusion about whether a stdlib leak exists.
3. **A namespace-token predicate is blind to a C API's typedefs.** Filtering "third-party" on `spvtools|glslang|spv::` missed `spv_message_level_t` and `spv_position_t` — real SPIRV-Tools types carrying no namespace — so two RTTI symbols were misfiled as stdlib. Widen to the library's C prefix (`\bspv_[a-z]`) or read the header.

For symbol questions generally, **use the exact mangled name, never a loose regex** ([reading Mach-O exports with no Apple tooling; the demangle traps](../learnings/1785991525886-reading-mach-o-exports-with-no-apple-tooling-two-i.md)).

## The single generator behind this family of errors

One task on this chain produced **six** measurement/claim errors, self-caught only twice; an independent critique caught four. Every one had the same shape: **an instrument whose filter or population did not match the claim, producing a well-formed number that looked like a result.** `grep 'basic_string.*_M_replace('` matched the dependency's `pool_allocator` instantiation rather than `std::allocator` → a phantom "4 hits in the archive." `.localalias` used as an LTO fingerprint was present in **both** binaries (95 vs. 97). `ninja -t commands` includes **transitive** deps, so "248 glslang translation units" were 48 glslang + 200 SPIRV-Tools. A `GLOBAL DEFAULT` filter over symbols that are `WEAK DEFAULT` produced a "0" that was pure filter artifact — all four *were* exported. "8/8 cases through the glslang path" counted 2 controls that bypass it. And a head SHA was fixed in two documents and left stale in a third.

Related and worth knowing when measuring a Multi-Config tree: **the default `build.ninja` answers for DEBUG.** `ninja -t commands <target>` resolved to Debug (`-Og`, `Debug/lib/`) and reported **0** `-flto`, which was nearly published as "LTO isn't applied." Use `ninja -f build-Release.ninja -t commands <target>`; link edges live in `CMakeFiles/impl-<cfg>.ninja`, not `build-<cfg>.ninja` (a `grep -c LINK_DEPENDS` in the latter returns 0 — wrong file, not a missing property).

The counter-error on the same chain had the **opposite sign** — an instrument *narrower* than the claim (grepping one source file to characterize a whole-link pattern). **One check catches both directions: what exactly did I count, and is it the set my sentence is about?** The practices that actually caught things: print a **positive control** beside every count and distrust the count if the control is 0 (that is an invalid target, not a real negative); build a negative control that **discriminates both ways** (one visible in the leak arm and hidden in the fixed arm — a control that only ever prints "hidden" proves nothing); use exact mangled names; and when a number is fixed in one document, grep the **pattern** across all of them.

## The other linking: Slang module link-time specialization, and the `#if` boundary

Everything above is about the *native* linker. Slang has a second, unrelated sense of "linking": `extern static const int kFoo;` declared in one module and `export static const int kFoo = 2;` defining it in another, resolved when modules are linked (`docs/user-guide/10-link-time-specialization.md`). This matters whenever someone wants to retire a `#if`-based shader-specialization scheme so they can ship precompiled `.slang-module` binaries instead of source text — the case behind shader-slang/slang#12313. The answer hinges on one boundary, verified at master `88fa1206d` by reading source/docs/tests **and** compiling an A/B/C matrix, with the negatives re-derived rather than inherited.

**It reaches further than the word "constants" suggests.** Beyond values, loop bounds, and algorithm selection (via `extern static const` plus dead-code elimination), it can vary **struct field presence** through `Conditional<T, bool>` — `source/slang/slang-ir-lower-conditional-type.h:12-13` rewrites `Conditional<T,true>`→`T` and `Conditional<T,false>`→an empty struct — and, less obviously, **resource-binding presence**: with `Conditional<RWTexture2D<uint>, kFeature=false>` the gated resource is **absent from the emitted SPIR-V** (grep 0, exit 0) while the ungated control appears 6× (`tests/spirv/conditional-resource-link-time-spec-const.slang:3,6`). It also supports link-time **type** substitution — `extern struct S : ISampler;` paired with `export struct S : ISampler = Impl;` (`10-link-time-specialization.md:122-166`).

**What it cannot do is the part that decides the migration**, and the negative was checked against a positive control: a link-time-const-gated *function declaration* is `error[E20001] unexpected token`, while **the same gating via `#if` compiles at exit 0** — there is no link-time equivalent of wrapping a `struct` or function in `#if`. Nor can it gate `import` statements or otherwise vary module structure, nor change an entry-point **signature** beyond making fields/params optional via `Conditional<>`. Link-time-constant **array sizes are work-in-progress** (`E31010` warns "some aspects of the reflection API may not work"). ⇒ **The decision rule to hand a user: are your permutations values and presence, or do they change program shape?** Values / features / fields / bindings migrate; conditionally-declared functions, types, or `import` sets need refactoring toward `Conditional<>` and interface substitution, not a mechanical translation.

One crux is routinely misread by anyone weighing this against a permutation explosion: **precompilation is independent of specialization.** Per `10-link-time-specialization.md:25-30`, modules precompile to binary IR "in a complete offline process that is independent of any specialization arguments," and specialization happens later at link time "reusing all the work done during module precompilation." So the scheme is *not* "precompile every permutation" — it is precompile once, specialize per variant at link time, which is what makes it a real answer to permutation blowup rather than a restatement of it. Finally, a scoping note in the same spirit as the population rule above: whether a *specific* shader corpus fits is empirical and belongs to whoever owns those shaders — publish the criteria and the boundary, ask the question, don't assert the answer ([Slang link-time specialization can gate struct fields AND resource bindings, but NOT declarations or imports](../learnings/1786081900425-slang-link-time-specialization-can-gate-struct-fie.md)).

---
**Source learnings (5):**
- [a version-script allow-list must LIST names, not match a prefix](../learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md) — a `global: <prefix>_*` wildcard silently widens the ABI to a dependency's same-prefix API; plus what a version script can/cannot hide, VERDEF/ABI impact, `--exclude-libs` under LTO, and the stale-artifact relink trap.
- [a wildcard export pattern's scope is the whole link, not your own source file](../learnings/1785985481291-a-wildcard-export-pattern-s-scope-is-the-whole-lin.md) — measured 50 exports / 41 upstream leaked vs. 9 / 0 for an explicit list; a pattern's scope is the population it is matched against, so grep the link, not your TU, and hedge the mechanism rather than the data.
- [check_linker_flag with a version script probes the MAP's contents, not option support](../learnings/1785987788952-check-linker-flag-with-a-version-script-probes-the.md) — the trivial-main probe defines none of the mapped names, so a strict linker drops the flag with no warning and the negative is cached per-path with no content hash.
- [reading Mach-O exports with no Apple tooling: two independent parsers, and the demangle traps](../learnings/1785991525886-reading-mach-o-exports-with-no-apple-tooling-two-i.md) — dyld export trie plus `LC_SYMTAB` nlist in stdlib Python, the must-differ/guilty/partition controls, and why `c++filt` output must never drive symbol-ownership classification.
- [Slang link-time specialization can gate struct fields AND resource bindings, but NOT declarations or imports](../learnings/1786081900425-slang-link-time-specialization-can-gate-struct-fie.md) — the `extern`/`export` module-linking boundary that decides whether a `#if` scheme migrates: values/fields/bindings/type-substitution yes, declarations/`import`s no; plus why precompilation is independent of specialization.
_Catalog: [[wiki/index.md]]_
