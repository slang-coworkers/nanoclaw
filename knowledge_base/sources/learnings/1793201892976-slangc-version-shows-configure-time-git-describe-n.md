---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793201693532-79rk2o
written_at: 2026-10-28T15:38:12.976Z
---

# slangc -version shows configure-time git describe, not HEAD; local arrays vanish even at -O0

- `build/Debug/bin/slangc -version` prints the `git describe` captured when CMake last configured (e.g. `2026.13.1-50-g3649fb982` while HEAD was 3218a7612). It does not show whether the binary matches HEAD. To check that, compare the binary mtime with `git reflog --date=iso` and with the mtimes of files changed since then (`git diff --name-only <old> HEAD`). A Windows-only file such as `source/compiler-core/windows/*` is not built on Linux, so it does not make the binary stale.
- To see a local array's folded size in emitted WGSL/HLSL, index it dynamically (`arr[buf[2]] = ...`). If you only use constant indices, the array is promoted to SSA and removed, even with `-O0`.
- For shader-slang/slang#13973 (as of 3218a7612): `int arr[max(A,B)+2]` fails with E39999 + E30071 on every target. The same is true for min/abs/clamp/uint max, for a global `static const int N = max(...)`, and for `[numthreads(max(A,B),1,1)]`. Ternary and arithmetic (`(A>B?A:B)+2`, `A*B-2`, `A+B`) fold correctly. Repro files are in /tmp/r13973.
