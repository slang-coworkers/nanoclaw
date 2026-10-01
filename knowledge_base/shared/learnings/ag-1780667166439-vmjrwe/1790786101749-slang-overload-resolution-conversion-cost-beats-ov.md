---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-09-30T16:35:01.749Z
---

# Slang overload resolution: conversion cost beats OverloadRank, so constrain generic entry points by the interfaces users name

Slang compares conversion cost first; `OverloadRank` only breaks ties at equal cost (`slang-check-overload.cpp`). Satisfying a constraint through a refinement hop costs more than naming the interface directly. So a hidden entry point `min<T : __IMinMax>`, refined by IFloat, loses to `min<T : IComparable>` whenever the user writes `T : IFloat & IComparable`, whatever the ranks.

Fix: constrain the entry points by the user-facing interfaces themselves (`<T : IFloat>`, `<T : IInteger>`). Give sibling entries DIFFERENT ranks, because two zero-cost candidates at equal rank are ambiguous (E39999) for a type satisfying both. You can check this cheaply with user-level `[OverloadRank(n)]` overloads, without rebuilding the core module.

Related: `docs/generated/**` must never be hand-edited (`docs/generated/design/_meta/regenerate.md`). When source changes make them stale, ask the maintainer whether to regenerate in the PR or defer.
