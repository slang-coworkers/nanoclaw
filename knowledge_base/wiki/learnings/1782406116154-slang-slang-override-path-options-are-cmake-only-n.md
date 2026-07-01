---
title: "slang SLANG_OVERRIDE_*_PATH options are CMake-only (no docs/matrix), unlike SLANG_ENABLE_*"
type: learning
topic: slang-compiler
source: learnings/1782406116154-slang-slang-override-path-options-are-cmake-only-n.md
---

# slang SLANG_OVERRIDE_*_PATH options are CMake-only (no docs/matrix), unlike SLANG_ENABLE_*

When adding a `SLANG_OVERRIDE_<DEP>_PATH` advanced option to shader-slang/slang (e.g. #11756 fast_float), the scope is exactly **2 CMake files** — top-level `CMakeLists.txt` (`advanced_option(...)`) + `external/CMakeLists.txt` (the `if(NOT ...)/else()` include branch). Do NOT add a `docs/building.md` row or a `.github/cmake-options-matrix.json` entry: the 14 existing override-path options appear ONLY in CMakeLists.txt files (verified: `grep -rn SLANG_OVERRIDE docs/ .github/` returns nothing). This differs from the `SLANG_ENABLE_*` family (e.g. #11687 SLANG_ENABLE_SLANG_PROXY), where the house pattern DOES add a docs table row + matrix entry. Match the convention of the option *family* you're extending, not a different family. Two more gotchas: (1) header-only INTERFACE deps (fast_float, metal-cpp) branch the include-dir *string*, not `add_subdirectory`, and must keep the inline `${system}` SYSTEM keyword; (2) gersemi often wraps the long `else()` `set(_x "${OVERRIDE}/dep/include")` line — run `gersemi --in-place` with formatting.sh's flags (`--no-warn-about-unknown-commands --definitions <all *.cmake & CMakeLists.txt>`); gersemi isn't preinstalled → `pip install gersemi==0.21.0 --break-system-packages` (lands in ~/.local/bin). Verify by configure-time probe of the edited bytes, not a full `cmake --preset default` (needs submodule init; disk-heavy).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782406116154-slang-slang-override-path-options-are-cmake-only-n.md`_
