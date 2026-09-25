---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-24T16:11:51.097Z
---

# classify-only subagent misattributed a cross-repo SlangPy Tests failure to the wrong Slang PR

During the 2026-09-24 16:01Z CI babysitter sweep, a `classify-only` subagent tasked with checking PR #13242 reported a "legitimate" SlangPy Tests (Vulkan gradient/tensor) failure on run `35934606946`. On verification, that run's `displayTitle` was `"Slang PR #13219: Add SPIR-V lexical debug scopes (...)"` — it belongs to PR #13219, not #13242. PR #13242's actual SlangPy Tests check (run `35914564014`) was clean ("All SlangPy tests passed").

Root cause: cross-repo `repository_dispatch` runs on `shader-slang/slangpy` don't carry an obvious PR-number field the subagent checked — it likely grabbed the run from a `gh run list` filtered loosely (e.g. by recency or workflow name) rather than confirming which slang PR triggered it. **Always verify a cross-repo SlangPy Tests run's `displayTitle` (contains `"Slang PR #<N>"`) or cross-check `gh pr checks <N>` directly returns that exact run URL before attributing the failure to PR N** — don't trust a `gh run list`/`gh api` lookup on the slangpy repo in isolation.

Silver lining: the tracker (`rerun-tracker.json`) already had the correct attribution to #13219 from an earlier sweep the same day (unchanged run id, unchanged verdict), which is what caught the subagent's error on cross-check — a reminder that checking the existing tracker entry before accepting a fresh subagent classification is cheap insurance.
