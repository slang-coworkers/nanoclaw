---
title: "A version-script allow-list must LIST names, not match a prefix — a wildcard can inherit the very defect you are fixing"
type: learning
topic: misc
source: learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md
---

# A version-script allow-list must LIST names, not match a prefix — a wildcard can inherit the very defect you are fixing

From shader-slang/slang#9146 (PR #12379): `libslang-glslang-<ver>.so` re-exports libstdc++
internals in release packages but not local builds. Fix = a linker version script. The generalizable
lessons are about **instrument validity** and **where a guarantee rests**, not about glslang.

## 1. `{ global: <prefix>_*; local: *; }` can silently WIDEN the ABI

The obvious spelling was `global: glslang_*` — all 9 of our exports share that prefix. But **upstream
glslang defines 41 `glslang_*` symbols of its own C API** (`glslang_program_create`, …). A `global:`
clause is an allow-list, so the wildcard matched those too. They weren't exported *only* because that
archive member is never extracted (we call glslang's C++ API, so `glslang_c_interface.cpp.o` is never
pulled in) — i.e. correctness rested on `--exclude-libs`, **the exact mechanism that fails in the
environment the bug is about.** Measured, forcing the member in with `--whole-archive` and no
`--exclude-libs`:

| version script | exports | upstream C-API leaked |
| --- | --- | --- |
| `global: glslang_*` | **50** | **41** |
| the 9 names listed | **9** | **0** |

**Rule:** when you add a guard, ask *what is this guard's correctness resting on?* If the answer is
the thing you're fixing, it's the wrong guard. Enumerate.
**Corollary:** the vendored dependency probably uses the same symbol prefix as your wrapper. Check
(`nm --defined-only <dep>.a | grep -E ' [TW] <prefix>_'`) before writing any prefix pattern.

## 2. Cheap facts that cost hours to rediscover

- **A version script does NOT resurrect an `STV_HIDDEN` symbol.** Verified with a control object
  carrying one hidden + one default same-prefix function; only the default one exported. So a script
  can't undo `-fvisibility=hidden`.
- **An *anonymous* version block (`{...};`, no version name) adds 0 VERDEF** → no symbol versioning,
  no ABI break, `dlsym("name")` still works. Verify: `readelf -d <so> | grep -c VERDEF` (before AND
  after — it must be 0 both times). A *named* node would be an observable ABI change.
- **`-fvisibility=hidden` DOES hide `std::` instantiations your TU emits implicitly** (measured
  `WEAK HIDDEN`). What it cannot override is an **explicit** attribute, and libstdc++ declares
  `namespace std _GLIBCXX_VISIBILITY(default)` — which is what tags the out-of-line
  `basic_string::_M_*` helpers. The blanket claim "hidden visibility can't hide std::" is FALSE; only
  the narrow version is true, and only the narrow version is needed.
- **`--exclude-libs,ALL` survives LTO.** Forced a dependency archive to genuine GIMPLE bytecode
  (138 `.gnu.lto` sections vs 0 stock) and `--exclude-libs` still localized everything. The popular
  "LTO dissolves the archive boundary so `--exclude-libs` is bypassed" story did **not** reproduce
  under GCC 12.2 / binutils 2.40. Don't repeat it as fact.
- **Find every consumer, not the obvious one.** `grep -rhoE '"<prefix>_[A-Za-z0-9_]+"' source/ tools/
  examples/` surfaced a **second** `dlopen` site nobody had mentioned. For a runtime-loaded module an
  omitted name is a *runtime load failure*, not a compile error — the highest-consequence way to be
  wrong.

## 3. Ninja Multi-Config: the default `build.ninja` answers for DEBUG

`ninja -t commands <target>` in a Multi-Config tree resolved to **Debug** (`-Og`, `Debug/lib/`) and
reported **0** `-flto` — which I nearly published as "LTO isn't applied." Use
`ninja -f build-Release.ninja -t commands <target>`; link edges live in `CMakeFiles/impl-<cfg>.ninja`,
not in `build-<cfg>.ninja` (a `grep -c` for `LINK_DEPENDS` in the latter returns 0 — wrong file, not a
missing property). Also **`ninja -t commands <target>` includes TRANSITIVE deps**: my "248 glslang
translation units" were 48 glslang + 200 SPIRV-Tools.

## 4. LINK_DEPENDS, and the stale-artifact trap that almost shipped

Adding a linker script needs `set_property(TARGET t APPEND PROPERTY LINK_DEPENDS <abs path>)` or
editing the script won't relink. **But it does not retroactively relink a binary built before the flag
existed.** After adding the flag I measured 9 exports / 0 `std::` and nearly reported success — then
`stat` showed the `.so` predated my edit by 13 minutes. Ninja had no reason to relink (the change
touches nothing the object depends on), so I'd have credited the fix for the pre-existing result.
**Always `rm` the artifact and force the relink before measuring, then check its mtime.**

## 5. The meta-lesson: six errors, one generator

I made **six** measurement/claim errors in this one task and self-caught only two; an independent
critique caught four. Every one had the same shape: **an instrument whose filter or population didn't
match the claim, producing a well-formed number that looked like a result.**
1. `grep 'basic_string.*_M_replace('` matched the dep's `pool_allocator` instantiation, not
   `std::allocator` → phantom "4 hits in the archive."
2. `.localalias` used as an LTO fingerprint — present in **both** binaries (95 vs 97).
3. `ninja -t commands` transitive deps (above).
4. Filtered `GLOBAL DEFAULT` for symbols that are `WEAK DEFAULT` → a "0" that was pure filter
   artifact (all 4 *were* exported).
5. "8/8 cases through the glslang path" — 2 were controls that bypass it.
6. A head SHA fixed in two documents and left stale in a third.

**Practices that actually caught things:** (a) print a **positive control** beside every count, and
distrust the count if the control is 0 — that's an invalid target, not a real negative; (b) build a
negative control that **discriminates both ways** (mine was visible in the leak arm, hidden in the
fixed arm — a control that only ever prints "hidden" proves nothing); (c) use the **exact mangled
name**, never a loose regex, for symbol questions; (d) when a number is fixed in one document, grep the
**pattern** across all of them.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785985189936-a-version-script-allow-list-must-list-names-not-ma.md`_
