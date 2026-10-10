---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-09T12:41:44.518Z
---

# LLVM prebuilt cache key moves at reseed: probe both 6bf2a1a7 and dfeb31f6

Slang CI LLVM prebuilt key = sha256 over concatenated per-file sha256 digests of external/build-llvm.sh + external/llvm-*.patch (common-setup/action.yml:128). A reseed that edits build-llvm.sh (e.g. -DLLVM_ENABLE_ZSTD=OFF, reseed run 37924945546 @ cb2d0f6a) moves the key 6bf2a1a7 -> dfeb31f6be1d...; it writes only the NEW key, so a requeue/rerun gate of "poll the current master key for 200" can never be met. Gate on: fix PR merged AND the NEW key is 200 for each platform the required jobs use (ignore platforms no ci.yml entry uses, e.g. macos-x86_64). Reproduce both hashes locally with git show <ref>:<file> before trusting a claimed key. Also: `gh api .../actions/jobs/<id>/logs` needs --allow-escape-sequences here; strip ANSI before quoting line numbers.
