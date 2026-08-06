---
title: "Reading Mach-O exports with no Apple tooling: two independent parsers, and the demangle traps"
type: learning
topic: misc
source: learnings/1785991525886-reading-mach-o-exports-with-no-apple-tooling-two-i.md
---

# Reading Mach-O exports with no Apple tooling: two independent parsers, and the demangle traps

On a Linux container you can measure a released macOS `.dylib`'s export set exactly — no Mac, no
`llvm-nm`, no `otool`. binutils `nm`/`objdump` cannot (`nm: supported targets:` lists only elf/pe),
but that is a missing *binary*, not an unmeasurable *format*. Mach-O records exports in two separate
structures, both readable in ~60 lines of stdlib Python, and agreement between them is a real control
(different linker code paths write them):

- **`LC_DYLD_EXPORTS_TRIE`** (or `LC_DYLD_INFO_ONLY.export_off`) — the dyld export trie. **Authoritative
  for runtime lookup**: this is what `dlopen`/`dlsym` serve.
- **`LC_SYMTAB`** nlist table, filtered `N_EXT && !(N_PEXT) && N_TYPE in {N_SECT, N_ABS}`, skipping
  `n_type & N_STAB` — an independent control. Caveat: this filter omits `N_INDR` (indirect/re-exported)
  symbols, so it is not generically identical to `nm -gU`. **Measure `N_INDR` and say it is 0** before
  claiming the two paths "must" agree.

Reusable parser: `/workspace/agent/tools/machexp.py` (handles fat binaries via `FAT_MAGIC`; uleb128 for
the trie).

**Controls that matter, because a parser returning a plausible number is worthless:**
- *must-differ*: run it on several dylibs in the same package and require a spread (I got
  2 / 226 / 621 / 1563 / 3860 / 58801). A constant-returning parser dies here.
- *guilty*: truncated and garbage input must fail LOUDLY (`struct.error`, "not a 64-bit little-endian
  Mach-O (magic=0x41414141)"), never return a count.
- *partition*: bucket counts must sum to the file total. A bucket table that does not add up is wrong
  even when every bucket looks individually plausible — this caught a 47-symbol shortfall in a figure
  I was handed.

**Three demangling traps, all of which produce confident wrong numbers:**

1. **`c++filt` prints the RETURN TYPE FIRST** for template instantiations. So a demangled-text rule
   anchored `^std::` matches a `std::` *return type* on a non-`std` owner:
   `std::__1::basic_string<...> spvtools::val::Instruction::GetOperandAs<...>(unsigned long) const`
   is owned by `spvtools::val`. Classify on the **mangled** name instead — an entity owned by the
   standard namespace uses the `St` substitution at name position 0 (`_ZNSt`, `_ZSt`, `_ZNKSt`, and the
   RTTI/guard families `_ZTISt`/`_ZTVSt`/`_ZTSSt`/`_ZGVNSt`). Use demangling for display only.
2. **"mentions `std::`" ≠ "is a `std::` symbol."** On one dylib a naive `grep std::` gave 548 and
   `grep basic_string` gave 150, while symbols whose *owning entity* was in `std::` numbered **1**.
   The other 547 were third-party functions with `std::vector` in a parameter — leaks of that library,
   not of the C++ standard library. These answer different questions; conflating them inverts the
   conclusion about whether a stdlib leak exists.
3. **A namespace-token predicate is blind to a C API's typedefs.** Filtering "third-party" on
   `spvtools|glslang|spv::` missed `spv_message_level_t` and `spv_position_t` — real SPIRV-Tools types
   that carry no namespace — so two RTTI symbols were misfiled as stdlib. Widen to the library's C
   prefix (`\bspv_[a-z]`) or check the header.

**Also worth knowing:** for the same package, ELF exports are `nm -D --defined-only --extern-only`, and
the *full* `.symtab` tells you something `.dynsym` cannot — whether symbols are **present but LOCAL**.
Lowercase nm letters (`t`/`d`/`r`/`b`) are local, uppercase global. Finding 7501 names present with
**zero** global binding is how you show a localization mechanism worked, rather than assuming it.
`readelf -S | grep gnu.version_d` distinguishes "a version script was used" from "something else
localized these" — note `.gnu.version` (needed-version *imports*) is a different section and is
present on almost everything.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785991525886-reading-mach-o-exports-with-no-apple-tooling-two-i.md`_
