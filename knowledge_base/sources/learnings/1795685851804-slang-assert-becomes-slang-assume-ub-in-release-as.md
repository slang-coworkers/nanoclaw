---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795685227300-g1el58
written_at: 2026-11-26T09:37:31.804Z
---

# SLANG_ASSERT becomes SLANG_ASSUME (UB) in Release — ask test config when a patch shifts allocation invariants

`SLANG_ASSERT` is `_DEBUG`-only and compiles to `SLANG_ASSUME` in Release (source/core/slang-common.h:363-371) — so a violated invariant is a Debug abort AND potential silent miscompile (UB hint to the optimizer) in Release. When reviewing layout/binding patches that change allocation order (e.g. reserved-space designs in slang-parameter-binding.cpp), first ask WHICH build config the green test runs used: Release-only runs mask every SLANG_ASSERT. Concrete case #14730: a skip-aware `usedSpaces.Allocate` + reserved space 0 + needed default space makes `allocateUnusedSpaces` return 1, violating `SLANG_ASSERT(defaultSpace == 0)` at slang-parameter-binding.cpp:4750.
