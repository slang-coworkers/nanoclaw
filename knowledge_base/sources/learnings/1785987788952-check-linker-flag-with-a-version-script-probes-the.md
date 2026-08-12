# check_linker_flag with a version script probes the MAP's contents, not option support — and caches the negative

Reviewing shader-slang/slang#12379 (add `-Wl,--version-script=slang-glslang.map` via `add_supported_cxx_linker_flags`). Slang's helper at `cmake/CompilerFlags.cmake:47-83` applies a flag only `if(${test_name})` after `check_linker_flag`, with no `else()` — a known silent drop. The non-obvious part is the interaction with a **version script**:

`check_linker_flag` links a trivial `int main(){}` that defines **none** of the names the map lists `global:`. Under a linker that rejects undefined versions (`-Wl,--no-undefined-version`), the probe fails **on the map's own contents**, not on genuine option support:

```
/usr/bin/ld: glslang_validateSPIRV: undefined version:
... (all 9) ...  collect2: error: ld returned 1 exit status
```

The asymmetry that makes it a defect — measured on GCC 12.2 / binutils 2.40:
- probe (trivial main, 0 of 9 names defined) under strict linker → **exit 1** → flag DROPPED, no warning
- real target (all 9 names defined) under the **identical** strict linker → **exit 0, 9 exports, 0 `std::`** → flag WORKS

So the probe rejects a flag that would have worked, and the hardening silently reverts to the pre-fix behaviour with a green build.

**Reachable without exotic toolchains:** `LDFLAGS` at first configure is documented CMake seeding of `CMAKE_EXE_LINKER_FLAGS`, and try_compile inherits it. Verified through real CMake with `grep -c no-undefined-version CMakeError.log` = 1 proving the flag reached the try-compile line (a first attempt via `CMAKE_REQUIRED_LINK_OPTIONS` produced a FALSE PASS — `check_linker_flag` overwrites that variable, so always confirm the flag is on the try-compile line before trusting the result). Slang's own `emscripten` preset already sets `CMAKE_EXE_LINKER_FLAGS`, so the pattern is live in-tree.

**Worse: the negative is cached and sticky.** `${test_name}` is a cache variable keyed on the absolute path with no content hash. Control test that discriminates:
```
reused build tree (one earlier failed probe), permissive linker + valid map → HAVE_VS=''   (still disabled)
fresh build tree,  same permissive linker + valid map                      → HAVE_VS='1'  (enabled)
CMakeCache.txt of reused tree: HAVE_VS:INTERNAL=
```
One transient bad probe **permanently** disables the hardening in that tree; editing the `.map` never re-probes.

Remedy is expressible and tested: read the derived cache var after the call and `message(WARNING/FATAL_ERROR)`; or probe a path-free form (`--version-script=/dev/null`) and apply the real flag with `target_link_options` directly.

Related facts measured the same session:
- **A `global:` name absent from the link is silent** — link exit 0, no warning (reproduced on the real module: the map lists `glslang_compile_1_3`, a stale `.o` lacked it, 8 exports, no error). Combined with `GlslangDownstreamCompiler::init` failing only when **all four** `m_compile_*` are null, and `m_link` dereferenced **unguarded** at `slang-glslang-compiler.cpp:426`, a dropped name is a crash or silent degradation, never a build error.
- **A bad/missing map IS a hard error** (`syntax error in VERSION script` / `cannot open linker script file`), so typos in the file fail loudly — only *omissions* are silent.
- **`#` comments ARE valid** in GNU ld version scripts (and gold) — tested directly, exit 0. lld accepts only `/* */`.
- **`global:` cannot resurrect an `STV_HIDDEN` symbol** — one link with both a hidden and a default-visibility name in the map: only the default one exports; the hidden stays `t`.
- Coverage claims need per-symbol scoping: `slang-emit.cpp:3379` gates the glslang **link** path on `spirvFiles.getCount() > 1`, so the 146 `-emit-spirv-via-glsl` tests exercise `glslang_compile*` but **never** reach `glslang_linkSPIRV` — the one name whose omission crashes.
