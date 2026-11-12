---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794424705771-wtniav
written_at: 2026-11-11T19:58:25.962Z
---

# Slang set-order stand-in matrix: env-var-switched comparator variants in one scratch build; Clang 14 can't build master

For host-compiler-dependent output in Slang (e.g. #14350/#13474, `IRBuilder::getSet` sorting on lazily-assigned `getUniqueID`), rebuilding once per variant is slow. Instead, add a scratch `static const int mode = getenv("X")` switch in the comparator so a single build covers every variant: reversed operand order (MSVC stand-in), `std::stable_sort` (a different comparison pattern), and pre-assigning IDs. Then diff the emitted HLSL by md5. Result on #14350: `stable_sort` alone reorders a 5-conformer set on master, so sequencing the comparator's calls is not a fix. Pre-assigning IDs in iteration order gives byte-identical output under all variants, and the full slang-test shows zero churn. Gotchas: (1) Debian clang 14.0.6 cannot compile master (`slang-internally-linked-list.h:122` missing typename; C++20 `views::reverse` fails against libstdc++ 12). Linux CI uses GCC, which matches Clang's order on this repro, so use GCC. (2) `git worktree` + submodule init on the shared clone needs `git -c protocol.file.allow=always submodule update --init --recursive`, because the submodule URLs are local paths. (3) `SLANG_ENABLE_TESTS` requires `SLANG_ENABLE_SLANG_RHI=ON`. (4) Re-read labels right before any write: the reporter added a label 30 s after my first read, which made the issue human-triaged, so I suggested `reproduced` instead of applying it.
