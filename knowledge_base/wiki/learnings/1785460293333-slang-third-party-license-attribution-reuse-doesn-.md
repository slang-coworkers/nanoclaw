---
title: "Slang third-party license attribution: REUSE doesn't cover statically-linked submodules"
type: learning
topic: slang-compiler
source: learnings/1785460293333-slang-third-party-license-attribution-reuse-doesn-.md
---

# Slang third-party license attribution: REUSE doesn't cover statically-linked submodules

**Context:** shader-slang/slang#12302 (2026-07-31) — external report that cmark-gfm is statically linked but its copyright notice isn't in the shipped copyright. Confirmed correct + broader.

**Finding (verified @ master HEAD dc9558d57, static inspection only — no build):**
- Slang manages license compliance with **REUSE** (reuse.software): `REUSE.toml` annotates in-repo files with SPDX ids, `LICENSES/` holds the matching license texts, `.github/workflows/reuse-compliance.yml` runs `fsfe/reuse-action` (`reuse lint`).
- **Gap: `reuse lint` does NOT recurse into git submodules** (they are separate projects), and `REUSE.toml` is not itself installed. So every statically-linked submodule under `external/` is outside Slang's REUSE annotation AND its copyright/redistribution notice reaches neither `LICENSES/` nor the redistributed artifact.
- Install ships only: top-level `LICENSE` + `README.md` + the `LICENSES/` dir (`CMakeLists.txt:642-654`). `LICENSES/` at HEAD = Apache-2.0, BSL-1.0, CC-BY-4.0, LLVM-exception, LicenseRef-UOI-NCSA, MIT, Unlicense — **no BSD-2-Clause.txt / BSD-3-Clause.txt**.
- **Statically-linked submodules whose BSD-family notice is missing:** `cmark` (BSD-2, `source/slang/CMakeLists.txt:280` LINK_WITH_PRIVATE libcmark-gfm), `lz4` (BSD-2, `source/core/CMakeLists.txt:7` + slang-rt), `glslang` (BSD-3, `source/slang-glslang/CMakeLists.txt:10`, gated SLANG_ENABLE_SLANG_GLSLANG, ships as separate loadable lib). BSD-2/3 binary clause requires reproducing the copyright notice in shipped materials → currently non-compliant.
- Covered OK (shipped): miniz/unordered_dense/mimalloc (MIT), fast_float (MIT/Boost), spirv-headers/spirv-tools (Apache-2.0). NOT shipped (test/example/header-only, no action): imgui, stb, tinyobjloader, metal-cpp, vulkan headers, glm.
- README (README.md:144-152) lists glslang/lz4 as "(BSD)" but a README mention ≠ the notice reproduction the license requires; cmark isn't even listed.

**How to check which external dep actually ships:** grep `source/*/CMakeLists.txt` for `LINK_WITH_PRIVATE` on the shipped targets (`slang`, `core`, `slang-rt`, `slang-glslang`, `slangc`, `slangi`) — distinguish from test/example/tool targets and header-only INTERFACE libs. `git submodule status external/<dep>` + read `external/<dep>/{COPYING,LICENSE*}` for the SPDX type.

**Fix shape (recommended A):** add `LICENSES/BSD-2-Clause.txt` + `LICENSES/BSD-3-Clause.txt`, install per-dep copyright NOTICES (a THIRD-PARTY-NOTICES file or install each shipped submodule's COPYING/LICENSE), register cmark in REUSE.toml, add cmark to README. Follow-up B: auto-aggregate shipped-submodule notices at install time. **This is a maintainer/legal-policy call → hold code for authorization; draft PR only.**

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785460293333-slang-third-party-license-attribution-reuse-doesn-.md`_
