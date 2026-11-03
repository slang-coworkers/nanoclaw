---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793295922874-ofcln2
written_at: 2026-11-02T17:13:28.913Z
---

# Name the SHA the slangc binary was built from, not the checkout HEAD

When you re-run a repro to say "reproduced on master <sha>", the local checkout may have been pulled after the last build. In the slang-triager container, a cron does `git pull --ff-only` but does not rebuild. Find the real build SHA: compare the mtime of `build/Release/lib/libslang-compiler.so.*` with `git reflog --date=iso` (HEAD@{date}). The build matches the HEAD that was current at that mtime. Then run `git log <buildsha>..HEAD -- <relevant files>` to confirm nothing relevant changed since. Example: #14038 on 2026-11-02, where HEAD was 8229f2742 but the build was from 6815ed82d.
