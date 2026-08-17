---
title: "CMake CACHE PATH absolutizes relative -D values against the cmake CWD — pass :STRING to keep them relative"
type: learning
topic: ci-tooling
source: learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md
---

# CMake CACHE PATH absolutizes relative -D values against the cmake CWD — pass :STRING to keep them relative

When you pass a **relative** path to a CMake cache variable that is declared `CACHE PATH` (or `FILEPATH`) via `-DVAR=relative/path`, CMake silently converts it to an **absolute** path relative to the **cmake working directory** (the dir cmake was launched from / `-B` build dir). This bites when downstream code string-concatenates the variable into another path.

**Real incident (shader-slang/slang#11602, extras/falcor.sh):** Falcor declares `FALCOR_LOCAL_SLANG_BUILD_DIR` as `CACHE PATH` and computes `SLANG_DIR = ${FALCOR_LOCAL_SLANG_DIR}/${FALCOR_LOCAL_SLANG_BUILD_DIR}` by raw concat. The script passed relative `build/Release` while running cmake from the Falcor dir, so CMake turned it into `<falcordir>/build/Release` (absolute). The concat then produced `<slangroot>/<falcordir>/build/Release/...` — a **doubled path** — and `slang.lib` failed to link (`LNK1104` on Windows; would fail on Linux too).

**Fix:** pass the value typed as a string so CMake does NOT absolutize it:
`-DFALCOR_LOCAL_SLANG_BUILD_DIR:STRING=build/Release`
The variable then stays relative and the concat resolves correctly. Verified on a Linux cmake-3.25 fixture: untyped/`PATH` → cache `:PATH=<cwd>/build/Release` (doubled IMPLIB); `:STRING` → cache `:STRING=build/Release` (correct IMPLIB).

**Bonus:** a `-DVAR:STRING=...` on reconfigure **overrides** a previously-cached absolutized `:PATH` entry (cache flips `:PATH`→`:STRING`), so no cache wipe/clean reconfigure is needed to recover.

**Diagnostic tell:** a doubled path like `<base>\<base>\.../foo.lib` in a link/IMPLIB error = a relative value was absolutized and then concatenated onto a base. Check the consumer's `CMakeCache.txt` for the var's TYPE (`:PATH` vs `:STRING`) and value. Repro the whole thing on Linux even for a Windows-only symptom — the `CACHE PATH` absolutization is platform-independent. An absolute path passed to the same var is NOT re-absolutized, so only the relative arg needs `:STRING`.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781660657132-cmake-cache-path-absolutizes-relative-d-values-aga.md`_
