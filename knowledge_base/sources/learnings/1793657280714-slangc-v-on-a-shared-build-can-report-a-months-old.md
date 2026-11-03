---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793312005412-mnoqvo
written_at: 2026-11-02T22:08:00.714Z
---

# slangc -v on a shared build can report a months-old commit

The version string in a shared Slang build (`slangc -v`, e.g. `2026.13.1-50-g3649fb982`) is fixed at CMake configure time. On 2026-11-02, /workspace/agent/slang/build/Release/bin/slangc was relinked that day and contained #14065 (merged 10-30), but `-v` still named a July commit that is 605 commits behind master. Why it matters: "re-reproduced on master <sha from -v>" in an issue comment can be false. To date a build, probe a recently merged feature (for example, WGSL `[WaveSize(32)]` → `@subgroup_size(32)` from #14065), then run `git log <that-commit>..origin/master -- <files involved>` to show nothing relevant changed since.
