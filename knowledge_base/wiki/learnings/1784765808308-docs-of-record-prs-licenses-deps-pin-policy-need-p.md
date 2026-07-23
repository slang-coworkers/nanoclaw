---
title: "Docs-of-record PRs (licenses/deps/pin-policy) need per-cell source verification"
type: learning
topic: misc
source: learnings/1784765808308-docs-of-record-prs-licenses-deps-pin-policy-need-p.md
---

# Docs-of-record PRs (licenses/deps/pin-policy) need per-cell source verification

A README that asserts dependency licenses, dependency→output mappings, or submodule pin policy draws many small factual review rounds — each legitimate. Verify every single cell from the authoritative source, never from analogy/memory:

- **Licenses:** read each dep's LICENSE/COPYING. Where there's no LICENSE file, read the source header banner (e.g. Slang's `external/dxc/` headers are University of Illinois/NCSA — stated in `dxcapi.h`'s banner, not a LICENSE file; lua's MIT text is in the copyright notice at the END of `lua/lua.h`, not a README). A wrong license in a repo doc is worse than omitting it.
- **Output mapping:** derive from actual `LINK_WITH_*` / `#include` consumers, not names. Gotchas found in slang: metal-cpp & Vulkan-Headers feed tools/examples/slang-rhi, NOT the compiler backend (the compiler never includes vulkan headers; slang-rhi fetches its OWN metal-cpp archive); slang-tint IS compiler-side (runtime-loaded for WGSL by source/compiler-core/slang-tint-compiler.cpp) while webgpu_dawn is a test-runtime lib; a vendored header with zero consumers (external/spirv/spirv.h) should be listed but not attributed an output.
- **Pin policy:** `.gitmodules` `branch =` may name a branch OR a tag (per extras/check-submodule-commits.sh). fast_float's `v8.2.7` is a TAG (no same-named branch); cmark's `gfm` IS that repo's default branch; only lua's pin is genuinely off the default branch. Don't call them all "branches" or claim they're all "unreachable from default."

Interpretation vs. fact: if a reviewer keeps pressing a SCOPE/interpretation call (e.g. "remove the option names the maintainer said to defer"), that's a maintainer-judgment question, not a fact — decide with justification (keep the #12176 core answer; don't shrink scope), ask the maintainer to confirm, and don't churn it through more review rounds. The codex delivery gate keys on OUTPUT_REVIEW=approve.

Gate mechanic: a `codex-reply` on an existing thread does NOT record toward the gate — each stage needs a fresh `STAGE:`-tagged `mcp__codex__codex` call with the canonical developer-instructions, re-run after every material edit so the recorded approve binds the FINAL bytes (the gate re-hashes the ### Attested files at send time).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784765808308-docs-of-record-prs-licenses-deps-pin-policy-need-p.md`_
