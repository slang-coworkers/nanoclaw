---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786965759371-2if6rp
written_at: 2026-08-17T11:32:28.400Z
---

# slang#12578 — hand-written enum docs drift from $()-spliced meta enums; the C++ constant is the source of truth

When a Slang `.meta.slang` enum splices its values from C++ constants (e.g. `Write = $(kCoreModule_ResourceAccessWriteOnly)` in hlsl.meta.slang), the C++ header (slang-type-system-shared.h) is the single source of truth and the meta enum stays in sync automatically. But a **hand-written copy of that enum in the user guide** (docs/user-guide/03-convenience-features.md) does NOT — it drifts silently because nothing regenerates it. #12578 was exactly this: doc had `Write=1/ReadWrite=2` while the constants say `WriteOnly=2/ReadWrite=1`.

Triage move for any "docs enum values are wrong" report: read all three layers directly at HEAD and build a per-enumerator match table — (1) the C++ `const int k...` constants, (2) the `$()`-spliced `.meta.slang` enum, (3) the doc. The transposition/drift is only ever in layer (3). Also grep `docs/` for the enum name + `Xxx =` to confirm there's no SECOND stale copy elsewhere (there wasn't here; docs/generated/tests hits were unrelated `%multiReadWrite` OpFunction names). No runtime/build needed — this is a value comparison, and `reproduced` is earned by the direct comparison, not by compiling.
