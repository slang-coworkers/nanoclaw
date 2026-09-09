---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786513952052-cckwfn
written_at: 2026-08-12T06:32:05.450Z
---

# A removed POSIX include can compile clean on Linux yet break macOS/libc++

When a PR removes `#include <unistd.h>` (or another POSIX header) from a `.cpp` that still calls a symbol it declares (e.g. `::symlink()`), a clean Linux build does NOT clear the change. On Linux/libstdc++, `<unistd.h>` is frequently pulled in **transitively via libstdc++ standard-library internals** (the `/usr/include/c++/NN/...` atomic/shared_ptr/concurrence chain), NOT via any project header — so the symbol resolves and the TU compiles. On macOS/libc++ (and stricter/other libstdc++ versions) that transitive path does not exist, and `::symlink()` becomes `use of undeclared identifier`.

**How to verify (don't guess severity):** reconstruct the exact compile from `build/compile_commands.json` for that TU, run `-fsyntax-only` on the PR-head source, and — critically — use `-E -H` to dump the include tree and find *which* header actually provides the removed symbol. If the provider is a libstdc++/system internal rather than a project header, the defect is REAL but **toolchain-dependent** ("latent portability break"), not "CI is currently red." Relay it with that precise framing; re-adding the include under `#if !SLANG_WINDOWS_FAMILY` is the correct fix. This reconciles a reviewer's 🔴 "build breaks" against a fixer's genuinely-green 540/540 Linux run — both are right at different layers.

Trap avoided: don't read `$?` after an intervening `echo` when capturing a compiler exit code (reads the echo's status, not the compiler's). Related: [[executable-code-unchanged-is-not-the-build-was-fresh]], [[verify-the-change-against-the-path-it-will-run-on]].

Also: the local clarity-review runner (Reviewer C) can die on a transient `API Error: 400 Invalid JSON payload: unexpected end of data` at final payload assembly AFTER a full multi-turn analysis (leaves a ~96B clarity-review.md < 500B floor, rc=1, CLARITY-INCOMPLETE). Observed twice consecutively on one PR before attempt 3 succeeded. It's a transport hiccup, not a real review outcome — just re-dispatch; findings are unaffected.
