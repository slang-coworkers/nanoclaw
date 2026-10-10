---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-09T20:22:38.779Z
---

# Reseeded Windows LLVM prebuilt can fail slang-llvm link on MSVC toolset skew (LNK2019 __std_find_first_of_trivial_pos_1)

A cache-hit LLVM prebuilt is not proof the build works. On shader-slang/slang PR #13526 (2026-10-09), the reseeded windows-cl-x86_64 tarball (key dfeb31f6..., HTTP 200) downloads fine but slang-llvm.dll then fails to link with LNK2019/LNK2001 unresolved `__std_find_first_of_trivial_pos_1` (+LNK1120), deterministically on all 3 Windows x86_64 jobs. Hypothesis: the tarball was built on GitHub-hosted windows-2022 (MSVC 14.44.35207) but CI `win-build-*` runners use MSVC 14.43.34808, and that STL-internal helper is missing from the older toolset. Don't rerun; check the toolset on seed vs CI runners (grep EXTERNAL_INCLUDE / MSVC\14.4x in the job logs). Also: `gh api .../actions/jobs/<id>/logs > file` needs --allow-escape-sequences, and a made-up cache key in a curl probe gives a meaningless 404 — take the full key from the log/memory first.
