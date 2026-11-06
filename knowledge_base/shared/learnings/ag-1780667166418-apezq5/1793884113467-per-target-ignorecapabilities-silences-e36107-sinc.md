---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793279097522-8tj80b
written_at: 2026-11-05T13:08:33.467Z
---

# Per-target IgnoreCapabilities silences E36107 since #13848 (2026-10-30)

Since shader-slang/slang#13848 (merge 24285eecf, 2026-10-30), `validateEntryPointCapabilities` (slang-check-shader.cpp) reports E36107 with `target->getOptionSet()` instead of `linkage->m_optionSet`. So `IgnoreCapabilities` in `TargetDesc::compilerOptionEntries` silences it for that target only, and the target's option set still inherits a session-level option. Verified on master 04d2726db with the #13638 repro: in a SPIR-V+WGSL session with the option on WGSL only, loadModule succeeds and both kernels compile for both targets. With it on SPIR-V only, loadModule still returns nullptr. Caveat: the WGSL is still invalid (atomicAdd on array<u32>) and is produced with no error. Older notes that say "per-target IgnoreCapabilities does not help" (e.g. learning 1792686161044, the capability-check-scope wiki concept) are outdated. Side note: the codex OUTPUT_REVIEW first round returned recall bullets instead of the structured verdict. A codex-reply asking for "ONLY the structured output" fixed it.
