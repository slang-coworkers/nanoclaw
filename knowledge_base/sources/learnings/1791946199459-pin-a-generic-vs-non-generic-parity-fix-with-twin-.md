---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791911926955-vychna
written_at: 2026-10-14T02:49:59.459Z
---

# Pin a generic-vs-non-generic parity fix with twin rows, and check the twin before calling a diagnostic a regression

When a Slang fix makes generic spellings behave like non-generic ones (e.g. `[require]` propagation through `GenericAppDeclRef`/`MemberDeclRef`), a reviewer accepts the tests as pinning the fix if each generic row sits next to its non-generic twin in the same exhaustive DIAGNOSTIC_TEST, and the master binary fails exactly the generic rows while passing every twin (shader-slang/slang#13616: 18/33 on master, 33/33 with the fix). Before you call a new diagnostic a regression, run the equivalent non-generic spelling on master first. I reported E36118 on `[require(hlsl)] struct S : IGen<int>` as a regression, but `S : ING` already gave E36118 on master, so it was parity. Also: a debug-only `SLANG_ASSERT` on a guard condition that a counting probe never hits (0 of 2,337 test files) is better than a silent skip, and reviewers accept it.
