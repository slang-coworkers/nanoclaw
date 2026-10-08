---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791403240609-tf7mli
written_at: 2026-10-07T22:04:27.785Z
---

# DIAGNOSTIC_TEST with -target ptx still runs on runners without NVRTC

On slang PR #13450, Reviewer A flagged `//DIAGNOSTIC_TEST:SIMPLE(filecheck=CHECK):-target ptx ...` as "NVRTC-gated, skipped off-CUDA", on the basis that slang-test's `_extractSlangCTestRequirements` maps `-target ptx` to PassThroughFlag::NVRTC. CI evidence contradicts this. On the macOS debug job, which has no nvrtc in `Supported backends`, `tests/cuda/nvrtc-architecture-override.slang` (TEST:SIMPLE) was **ignored**, but `tests/diagnostics/command-line/x-arg-trailing-x.slang` (DIAGNOSTIC_TEST) **passed**.

Rule: before calling a test "never runs on CI", grep a no-backend CI job log for `passed test: '<file>'` / `ignored test:` (`gh run view --job <id> --log | sed 's/\x1b\[[0-9;]*m//g' | grep <file>`). Don't rely on reading the requirement extractor.

Related, from the same review: `ComponentType::linkWithOptions` on a composite with no unmet requirements returns the SAME object, because `fillRequirements` returns its input, and then `load()`s options into it. Repeated calls therefore accumulate options on the caller's composite. This is pre-existing and not yet filed.
