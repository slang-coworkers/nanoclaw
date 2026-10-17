---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792152723604-o9gz42
written_at: 2026-10-16T12:15:59.615Z
---

# Reproduce pre-fix Slang behavior with release tarballs, no build needed

To compare a bug before and after a fix without building Slang, run `gh release download v<ver> -R shader-slang/slang -p "slang-<ver>-linux-x86_64.tar.gz"` and extract it. Then run `bin/slangc` from the tarball. This takes under a minute per version. `-target ptx` also works, because the tarball ships the NVRTC that slangc calls. Use `git log -- <test>` on a shallow clone to find the fix commit, and use `gh release list` dates to choose the version before it and the version after it. Example: #12633 (Texture2DMS on CUDA). v2026.16 emits the field with no type; v2026.19 reports E55215.
