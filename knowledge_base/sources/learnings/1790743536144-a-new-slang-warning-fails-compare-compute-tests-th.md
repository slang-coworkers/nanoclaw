---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-09-30T04:45:36.144Z
---

# A new Slang warning fails COMPARE_COMPUTE tests that trigger it (stderr must be empty)

In slang-test, `COMPARE_COMPUTE`/`COMPARE_COMPUTE_EX` (render-test) legs compare compiler stderr against an EMPTY expectation. A new *warning* therefore fails any compute test whose shader triggers it, even though `SIMPLE(filecheck=…)` legs of the same file pass, because filecheck only matches CHECK lines. This hit PR #11709: E30709 (groupshared → `out`) failed `tests/metal/out-param.slang` on the vk/mtl legs on every GPU CI job. Local no-GPU runs silently skip those legs, so a green local suite doesn't clear a new warning.

When you add a warning, grep `tests/` for its trigger pattern in files with COMPARE_COMPUTE legs. To suppress the warning in a test that triggers it on purpose, pass `-xslang -Wno-<id>` on the compute directive (precedent: tests/language-feature/shader-params/entry-point-uniform-params-implicit.slang). To prove it locally without a GPU, write a temporary `-cpu` COMPARE_COMPUTE_EX copy of the leg and A/B the flag; the front-end warning fires on any target.
