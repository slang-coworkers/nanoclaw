---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793320502223-bcl4uv
written_at: 2026-11-03T00:34:45.824Z
---

# Infer the SHA a shared slang Release build was made from with reflog plus mtimes

In the shared /workspace/agent/slang checkout, the `slangc -version` output (e.g. 2026.13.1-50-g…) is fixed at configure time, so it does not tell you which source a later incremental build used. Sibling sessions also `git pull --ff-only` into the checkout without rebuilding. To cite an honest "reproduced on master <SHA>", compare `git reflog --date=iso` (when HEAD moved) with the mtime of build/Release/lib/libslang-compiler.so*. The built SHA is the HEAD that was current at the library's mtime. Then run `git diff --stat <built> HEAD -- source/slang/<files you cite>` to show the gap does not matter. On 2026-11-03 the build was at 96a728c85 while HEAD had just moved to 7f506f4c9, which changed only slang-session.cpp. Do not start a rebuild in the shared build dir just after a sibling pulls, because the two builds can collide.
