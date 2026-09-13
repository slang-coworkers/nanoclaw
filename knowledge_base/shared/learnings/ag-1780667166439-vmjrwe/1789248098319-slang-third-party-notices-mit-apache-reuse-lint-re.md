---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789167269928-xclyue
written_at: 2026-09-12T21:21:38.319Z
---

# Slang third-party notices: MIT/Apache reuse-lint reasoning differs from BSD; spirv-headers ships codegen

When extending the `third-party-notices/` install mechanism (CMake `metadata` component, precedent PR #13021) to more vendored deps:

- **The "bare `LICENSES/*.txt` = unused-license reuse failure" argument is BSD-specific.** #13021 justified shipping the dep's own LICENSE (not a `LICENSES/BSD-2-Clause.txt` template) partly because adding a bare BSD SPDX template trips `reuse lint` (no in-tree file uses that SPDX id; the compliance job checks out without submodules). This does NOT hold for **MIT/Apache-2.0**: `LICENSES/MIT.txt` and `LICENSES/Apache-2.0.txt` already exist and are *used* by in-tree files, so they wouldn't be flagged unused. For the MIT/Apache class the correct reuse-green reasoning is simply: the change **adds nothing to `LICENSES/`** (notices ship via the `metadata` install component, independent of REUSE). Don't copy #13021's "would be unused" wording verbatim — it's inaccurate for MIT/Apache.

- **Per-license obligation differs, state it precisely.** MIT: reproduce the dep's actual copyright-holder lines (a generic `LICENSES/MIT.txt` lacks them). Apache-2.0 (e.g. spirv-tools): §4(a) = give recipients a copy of the license; §4(d) NOTICE-carry applies **only if upstream ships a NOTICE file** — spirv-tools has none, so LICENSE-only is correct. Shipping spirv-tools' own LICENSE is per-dependency *provenance*, not "previously-absent Apache terms" (the terms are already in `LICENSES/Apache-2.0.txt`).

- **spirv-headers is NOT "no compiled code".** Its SPIR-V grammar JSON (`spirv.core.grammar.json`, `extinst.glsl.std.450.grammar.json`) is transformed at build time into generated C++ (`slang-lookup-generator` / `slang-spirv-embed-generator` → the `slang-lookup-tables` object library, `source/slang/CMakeLists.txt:155-210`) that compiles into the shipped `slang` binary. So a header-only INTERFACE dep can still put derived content in the binary via codegen.

- **mimalloc's `SLANG_BUILD_MIMALLOC` is `set()` in `external/CMakeLists.txt` without `PARENT_SCOPE`** → not visible at top-level `CMakeLists.txt` where install rules live. Duplicate its boolean inline (guard the notice), and comment that the variable is out of scope so nobody "simplifies" it to `if(SLANG_BUILD_MIMALLOC …)` (silently false → notice stops shipping, uncaught on Linux where mimalloc is off).

Ref: shader-slang/slang#13023 → PR #13040 (follow-up to #13021).
