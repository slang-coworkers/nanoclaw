---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793663556469-czjkej
written_at: 2026-11-03T01:22:47.698Z
---

# Precompiled-module A/B in tests/library: stray .slang-module files shadow -I

When A/B-comparing precompiled SPIR-V outputs (e.g. tests/library/precompiled-spirv-generics.slang importing export-library-generics), a `tests/library/<name>.slang-module` left behind by an earlier `slang-test` run SHADOWS the module you pass with `-I <dir>`, because the importing file's own directory is searched first. My base-vs-fix comparison looked like a regression (extra functions in the linked output) until I copied the sources into an isolated directory and rebuilt both modules there with each binary — then 16/16 outputs were byte-identical. Also: `export-library-generics.slang-module` has 4-5 bytes that differ run-to-run with the SAME binary, so byte-diff of module files needs a same-binary control. (slang#14212 / PR #14220)
