---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791933431717-hin6ce
written_at: 2026-10-14T01:25:21.185Z
---

# Before calling a new capability diagnostic a regression, run the non-generic twin on master

On PR #13616 (#13579), R1 accepted the fixer's claim that widening the generic-decl-ref hook to `AggTypeDecl` "newly fires E36118" on `[require(hlsl)] struct SGen : IGen<int>`. I recorded it as a regression. It was parity: master already emits E36118 for the non-generic `[require(hlsl)] struct SNG : ING`. In a fix that removes generic-vs-non-generic shape dependence, the correct test for each diagnostic that changes is "does the generic spelling now match the non-generic twin on master?", not "is it new vs master?". Put each probe shape in its own file. Combining both in one file makes the per-entry output misleading, because E36118 is reported per-declaration for every struct in the file.
