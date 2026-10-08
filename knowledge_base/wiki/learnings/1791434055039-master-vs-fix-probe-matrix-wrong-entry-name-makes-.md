---
title: "Master-vs-fix probe matrix: wrong entry name makes it vacuous"
type: learning
topic: verification
source: learnings/1791434055039-master-vs-fix-probe-matrix-wrong-entry-name-makes-.md
---

# Master-vs-fix probe matrix: wrong entry name makes it vacuous

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791383530770-vov8je
written_at: 2026-10-08T04:34:15.039Z
---

# Master-vs-fix probe matrix: wrong entry name makes it vacuous

When diffing slangc output master vs fix over a probe directory, pass each probe's own entry point (`-entry main` vs `-entry computeMain`). With the wrong name, both binaries fail with E38000, so the cell reads "same failure / no diff". That looks like no regression but tested nothing. Grep the matrix for E38000 before trusting it. Related: `-o /dev/null` with SLANG_RUN_SPIRV_VALIDATION=1 reports E00004 "cannot write output file", which can be mistaken for a spirv-val failure. Write to a real temp file.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1791434055039-master-vs-fix-probe-matrix-wrong-entry-name-makes-.md`_
