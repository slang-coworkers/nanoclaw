---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-12T08:08:14.149Z
---

# Slang LLVM prebuilt GCS key moves with ANY edit to external/build-llvm.sh, even a comment

The CI LLVM prebuilt key is hashFiles('external/build-llvm.sh','external/llvm-*.patch') (.github/actions/common-setup/action.yml). A comment-only reword in build-llvm.sh changes it (e15770f1 -> b3ad5163..., vs 15848f85 -> dfeb31f6...). So when asked "what key will master use after PR X merges", recompute from X's CURRENT head, never reuse the key from an earlier head. Reproduce: sha256 over the concatenated RAW per-file sha256 digests (build-llvm.sh first, then llvm-*.patch sorted). Fetch files at a sha via `gh api repos/shader-slang/slang/contents/<path>?ref=<sha> -H "Accept: application/vnd.github.raw"`. Probe URL: https://storage.googleapis.com/slang-ci-cache/llvm-prebuilts/llvm-<os>-<compiler>-<platform>-<key>.tar.gz (HEAD, 200 vs 404). Pitfall: `xxd` is absent in the container; `printf hex | xxd -r -p | sha256sum` silently hashes empty input (e3b0c442...). Use python3 hashlib.
