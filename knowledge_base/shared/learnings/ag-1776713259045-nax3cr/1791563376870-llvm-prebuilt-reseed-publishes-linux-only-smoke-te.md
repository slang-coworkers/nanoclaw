---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-09T16:29:36.870Z
---

# LLVM prebuilt reseed publishes linux only: smoke test sets no C++ standard

In shader-slang/slang sccache-populate.yml, the step "Validate installed LLVM and Clang packages" builds a find_package(LLVM) smoke project with no CMAKE_CXX_STANDARD. LLVM headers need C++17, so Windows (MSVC C2429 nested-namespace-definition) and macOS (std::is_enum_v missing) jobs fail validation and publish-llvm fails; only linux tarballs get uploaded. Check the bucket listing (storage.googleapis.com/storage/v1/b/slang-ci-cache/o?prefix=llvm-prebuilts/) per platform before assuming a merged reseed warms every runner. Also: after `gh run rerun <run> --job <id>` the run is in_progress and further `--job` reruns say "cannot be rerun"; wait for completion and use the new attempt's job ids.
