---
name: project-12380-macos-glslang-export-bound
description: "slang#12380 macOS glslang export list unbounded — MEASURED 3860 exports vs 9 intended; issue's own 'not verified on macOS' gate cleared without a Mac"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9bb4e9b6-5724-4379-9c3f-6b873fd0a26e
---

shader-slang/slang#12380 — "slang-glslang: export list is not bounded on macOS (Mach-O needs
`-exported_symbols_list`)". Bot-authored (`nv-slang-bot[bot]`), OPEN, 0 comments, no labels, no
assignees, created 2026-08-06T03:47:57Z. Follow-up to #9146 / PR #12379 (see
[[project_9146_glslang_stdlib_reexport_lto]]).

**Chain state at arrival:** PR #12379 OPEN, not draft, unmerged, head `2876c3a7b2` (**moved** from
the `20a71c6cb3` recorded in the 9146 memo — that memo's "FINAL STATE" head is stale).
Cross-referenced #12355 (`m_link` unguarded deref) verified OPEN, bot-authored.

## ⭐⭐⭐ The issue's own stated blocker is CLEARED — and it was never a real blocker

The issue says: *"this repo's CI is the only Darwin toolchain available to the bot, so whether the
released `.dylib` actually exhibits the leak has **not** been measured … that should be checked with
`nm -gU` on a released `libslang-glslang-<ver>.dylib` before any code is written."*

**That is a capability-negative, and it is false.** Measured from this Linux container, no Mac and no
Apple toolchain:

- Release assets are plain `gh release download` (`slang-2026.14.1-macos-aarch64.tar.gz`).
- `nm`/`objdump` here are binutils and **cannot read Mach-O** (`nm: supported targets:` lists only
  elf/pei/pe variants — no mach-o). `llvm-nm`/`llvm-objdump` MISSING. So the *tool* was absent…
- …but the **format is parseable directly**. Mach-O carries the export set twice: the `LC_SYMTAB`
  nlist table and the dyld export trie (`LC_DYLD_INFO_ONLY` / `LC_DYLD_EXPORTS_TRIE`). ~60 lines of
  stdlib Python reads either. **Two independent parsers agreed: 3860 / 3860, 9 `glslang_*` both.**

⇒ **"No toolchain" was a statement about a binary in `PATH`, published as a statement about
measurability.** The prerequisite the issue set for itself was satisfiable in minutes. See
[[feedback_published_negative_env_claims_need_rederivation]] — 3rd instance of this class.

## The leak is REAL and far worse than the issue supposed — but of a DIFFERENT KIND

`libslang-glslang-2026.14.1.dylib`: **3860 exported symbols (arm64) / 4130 (x86_64) where 9 are
intended.** ⛔ **The breakdown below is my ORIGINAL and it DOES NOT CLOSE — it sums to 3813 vs the
stated 3860 (delta 47). Kept only to show what was dispatched; use the triager's closing partition
(§TRIAGED, with a printed residual bucket) for any figure you intend to publish.**

| bucket (arm64) | count |
|---|---|
| `spvtools::` | 2443 |
| `glslang::` | 1032 |
| `spv::` | 212 |
| legacy `Sh*` / plain-C (`ShCompile`, `ConstructCompiler`, …) | 115 |
| **`glslang_*` (the intended C ABI)** | **9** |
| `std::` (libc++) — ⚠️ *undefined quantity, see correction #2* | **2** |
| ⛔ *unaccounted* | **47** |

Linux counterpart, same release: `libslang-glslang-2026.14.1.so` = **13** exports (9 `glslang_*` + 4
`std::__cxx11::basic_string::_M_{replace,assign,create,mutate}`). **13 vs 3860.**

⭐⭐ **The issue's libc++ hypothesis holds on arm64 ONLY — my arch-neutral version was wrong, see
correction #4 below.** *Owned* `std::` is arm64 **1** / Linux **4** / **x86_64 127** (of which 10 are
genuine libc++ exception-hierarchy RTTI absent from arm64). So `_LIBCPP_HIDE_FROM_ABI` stops the
#9146 libstdc++ mechanism on arm64 and **fails on x86_64**. #12380 is still *not* simply "macOS ships
the pre-#12379 #9146 behaviour": what escapes is overwhelmingly third-party **definitions** —
thousands of default-visible `glslang`/`SPIRV-Tools` symbols. ⛔ **NOT "the entire static-library
interior" — that phrase was mine and is false: 3860 external vs 13340 local+pext.** Severity is
still up and the issue's *description* is still wrong as filed.

**Mechanism (inference from CMake + consistent with the measurement — NOT executed, no ld64 here):**
`source/slang-glslang/CMakeLists.txt:19-39` bounds exports with exactly two mechanisms.
(1) `CXX_VISIBILITY_PRESET hidden` applies only to **slang-glslang's own TUs** — it cannot touch
objects inside the static libs it links. (2) `-Wl,--exclude-libs,ALL` is the flag that localizes
those archives, applied via `add_supported_cxx_linker_flags` → `check_linker_flag`
(`cmake/CompilerFlags.cmake:47-83`, probe `:71`, `if(${test_name})` `:72`), which **silently drops a
flag the linker rejects — no warning**. If ld64 rejects it, only the visibility preset remains, which
predicts 3860. ⚠️ **"GNU-ld-only" was DROPPED as unverified** — `--exclude-libs` is a GNU ld option
(verified locally, binutils 2.40) but that says nothing about ld64. Neither the rejection nor the
drop was observed: no Darwin linker, no Darwin configure log.

**Other modules, same release (macOS / Linux):** `libslang-llvm` **58801** / 31 · `libgfx` 1563 / 14
· `libslang-compiler` 621 / 636 · `libslang-rt` 226 / 229 · `glsl-module` 2 / 2. So the issue's
closing note ("a per-module fix does not address that") is right, and much larger on Darwin.
⚠️ Divergence does **not** cleanly track the three `--exclude-libs` users — `libgfx` diverges without
the flag (1511 of 1563 are macOS-only `metal-cpp`: `MTL::`/`NS::`/`CA::`), and `glsl-module` uses the
flag yet is 2/2 (links only in-tree `core`, which does get hidden visibility).

## Verified sub-claims of the issue body

- ✅ **"`libslang-llvm.so` exports 26 `std::` symbols out of 31"** — CONFIRMED by demangling
  (`c++filt`): 31 total, 26 `std::`-related. ⛔ **My own mangled-name regex said 14 and was wrong** —
  see [[feedback_a_mangled_name_prefix_regex_undercounts_std_exports]].
- ✅ `-Wl,-exported_symbols_list` is the right Mach-O primitive and needs its own file format
  (one name per line, C symbols `_`-prefixed). Confirmed present in-tree as prior art:
  `build/_deps/dxc_source-src/cmake/modules/AddLLVM.cmake:86` uses `-exported_symbols_list` on APPLE
  and `:105` uses `--version-script` otherwise — the exact two-file pattern #12380 proposes.
- ✅ The sync concern is real and sharpened by #12355: the nine names would live in two files with
  different syntaxes, a missing name is silent at link time, and `m_link` is dereferenced unguarded
  at `source/compiler-core/slang-glslang-compiler.cpp:428` (assigned `:102`; `init` guards only the 4
  compile pointers `:104-108`) ⇒ dropped name = crash, not diagnostic. ⚠️ I had cited `:426` from the
  #9146 memo; the triager's read at HEAD `9cd92bb3a` says `:428`.
- Prefixing: on Mach-O the nine names appear as `_glslang_compile` etc. — the leading `_` is the C
  symbol prefix, so the Mach-O list needs it and the ELF `.map` must not.

## ✅ 2026-08-06 04:41Z — TRIAGED by slang-triager. 3 of my claims corrected; I re-verified ALL of them myself.

Verdict comment **5200463220** (`nv-slang-bot[bot]`, 7482 chars, fresh/0 prior), labels `Packaging` +
`reproduced`, Type → Build. Issue still OPEN, no fixer dispatched (fix shape = maintainer call).
Memo: `/workspace/inbox/a2a-1785991561191-f9v7iy/triage-12380.md` (161 lines).

**Independently reproduced by me before relaying (their parser and mine are separate code):**
`arm64 3860` ✅ · **`x86_64 4130`** (new axis, I measured it) · Linux `13` ✅ · `spvtools:: 2443` ✅ ·
`glslang_* 9` ✅.

⛔ **THREE CORRECTIONS TO MY DISPATCH — all reproduced, all mine to own:**
1. **My bucket table did not close: it sums to 3813 against its own stated TOTAL 3860 — delta 47.**
   I published a table whose parts contradict its total, in the same message where I told the peer to
   re-derive everything. Arithmetic on my own figures would have caught it; I never summed the column.
   ⇒ [[feedback_a_bucket_table_must_be_shown_to_close]].
2. **My `std:: = 2` conflated OWNERSHIP with MENTION.** Naive whole-list `grep std::` = **548**;
   *owned* (mangled-prefix test) = arm64 **1** / Linux **4** / **x86_64 127**. Three different
   quantities; I reported one number with no definition attached.
3. **"the entire static-library interior" is FALSE and was my phrase.** arm64 `LC_SYMTAB` = 17375 →
   **3860 external-defined / 13340 local+pext / 175 undefined / 0 STAB** (I re-ran this myself). Most
   of the interior *is* local. The true claim is narrower: thousands of default-visible
   glslang/SPIRV-Tools definitions escape, not "everything".

⭐⭐⭐ **The libc++ conclusion is ARCH-DEPENDENT, and my arch-neutral version was wrong.**
Verified myself: x86_64's 127 owned = **102 parameterized on third-party types / 25 purely-stdlib**,
and the 25 include **10 genuine libc++ exception-hierarchy RTTI symbols** — `typeinfo` +
`typeinfo name` for `std::{bad_alloc, bad_array_new_length, exception, length_error, logic_error}`,
each **0 on arm64 / 2 on x86_64**. ⇒ `_LIBCPP_HIDE_FROM_ABI` holds on arm64 (1 < libstdc++'s 4) and
**fails on x86_64**. I measured only arm64 and generalized to "macOS". **Never state it arch-neutrally.**

⛔ **My prior-art recommendation had a mechanical defect (codex caught it, not me): PR #12379's
`slang-glslang.map` CANNOT be DXC's `add_llvm_symbol_exports()` input as it stands.** I verified by
reading the diff: the file is a *full version script* — comments, `{`, `global:`, `local: *;`,
semicolons. DXC's Darwin path is `sed -e "s/^/_/"` over a **bare newline-separated name list**
(`AddLLVM.cmake:81`, applied `:86`; GNU script SYNTHESIZED `:92-96`, applied `:105`). Over this file
that emits `_# Export list...`, `_{`, `_    global:`, `_        glslang_compile;` — invalid Mach-O
list. My cites `:86`/`:105` were exact; my inference that the existing file could feed them was not.
⇒ Two valid shapes: factor the 9 names into a plain list and generate both, or keep the map canonical
and extract names with a parser.

**Triager's own instrument traps (5, all self-caught or codex-caught) worth carrying:** the script on
disk had drifted from the method it attested to (classified demangled text while the published figure
came from an inline mangled-prefix heredoc); `c++filt` prints the **return type first**, so a
`^std::` rule on demangled text matches a std:: return type on a non-std owner; a namespace-token
predicate is blind to a C API's typedefs (`spv_message_level_t` → split was 100/27, correct 102/25);
a bare grep COUNT cannot tell an assertion from a retraction clause (check position); and a subagent's
"`git grep` = 0, no prior art" was **tracked-files-only** — the DXC file is an untracked fetched dep.
⭐ *A tracked-only grep is an aperture, not an absence.*

**Also confirmed:** LTO is dead as an explanation here — `SLANG_ENABLE_RELEASE_LTO=ON`
(`release.yml:156`) applies to all platforms uniformly, so it cannot explain 13-vs-3860. Do not
resurrect it.

## Next action

**TRIAGE COMPLETE — chain parked on a maintainer decision. Nothing left with me.**
RESUME = maintainer picks the fix shape (bare-list-generates-both vs parser-over-map) or says "make a
PR" → release `slang-fixer` for a DRAFT PR (`pr: non-breaking`, `Fixes #12380`, must run
`formatting.sh` — formatters are absent in the triager's container). **CO-TRIGGER: PR #12379 merging**
makes this the last remaining platform gap; re-read the merged diff before refreshing cmt 5200463220.

**Nothing published to GitHub by me** — the triager owned the comment (closest-to-the-state). My
instruction to re-derive before publishing is what surfaced all three of my errors; it was the
load-bearing part of the dispatch.

**Open / unmeasured, do not let the above imply otherwise:**
- Whether ld64 actually rejects `--exclude-libs,ALL` — **still INFERENCE on both sides**, no Darwin
  linker or configure log. The triager stripped a "GNU-ld-only" clause of its own for this reason.
  Upgraded supporting evidence (theirs, consistency not proof): in the shipped Linux `.so` those
  symbols are **present but local** — 7501 `spvtools::` names with **zero** global binding, `.dynsym`
  defined-extern = 13, the nine `glslang_*` are `T`; `.gnu.version_d` = 0 rules out a version script.
- Whether an `-exported_symbols_list` fix works — untestable here; no Mach-O linker.
- ✅ `macos-x86_64` now measured (4130). Both arches covered.
- Why the archive interior is default-visibility is **source-derived, not measured from objects**:
  glslang's hidden-visibility helper is gated on `BUILD_SHARED_LIBS`
  (`external/glslang/CMakeLists.txt:270`), SPIRV-Tools sets it only on its `-shared` target
  (`external/spirv-tools/source/CMakeLists.txt:353`), and both arrive via plain `add_subdirectory` so
  never reach `set_default_compile_options` (`cmake/SlangTarget.cmake:329-333`).
- ⚠️ Divergence does NOT cleanly track the three `--exclude-libs` users: `libgfx` diverges
  (1563/14) **without** the flag because 1511 of its exports are `metal-cpp` (`MTL::`/`NS::`/`CA::`),
  a macOS-only dep. `glsl-module` uses the flag and is 2/2. The triager nearly published the clean
  version of that claim and caught it.

## ✅ 2026-08-19 16:19Z — HUMAN MAINTAINER TOOK OWNERSHIP. Chain handed off; fleet stands down.

`jhelferty-nv` (human) commented (cmt **5344920544**) on this chain I'd closed:
*"@jkwak-work I'm going to assign this to you since it's a follow-up to #9146. I suspect we will want
to make the mac file a generated file based on the symbol map for other platforms, or vice versa, to
keep a single source of truth."* Verified live: issue now **assigned to `jkwak-work`**, still OPEN,
labels `Packaging`+`reproduced` unchanged.

⭐ **The maintainer independently landed on our triage's recommendation** — single source of truth,
generate one platform's export file from the other (our two shapes: bare-list-generates-both, or
parser-over-map). No new gap, no question to us, no counter-proposal.

⛔ **This does NOT fire the "maintainer picks fix shape → release slang-fixer" RESUME trigger, and the
old RESUME is now STALE.** Two reasons: (1) he **assigned to a HUMAN** (jkwak-work), which is a handoff
to that person, not authorization for the bot to open a PR — opening an unsolicited draft PR over a
just-assigned human is the outward-facing over-step to avoid; (2) **not a bot mention** (`@jkwak-work`,
not `@nv-slang-bot`) and **no `<github-post-authorized />`** ⇒ no GitHub write authorized either.
⇒ **Neuter the PR-#12379-merge co-trigger: do NOT dispatch the fixer on it unless jkwak-work explicitly
asks.** New RESUME = human owns it; re-open only if jkwak-work (or another maintainer) requests bot help.

**Disposition:** nothing posted to GitHub by us (maintainer's own comment records the assignment
publicly; triager owns the thread but has nothing to add). Told the triager to stand down + refresh
its RESUME. Reported the handoff to the user (top-of-chain up = user).