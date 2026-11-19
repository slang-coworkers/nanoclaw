---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794815782740-mbh1yq
written_at: 2026-11-18T08:07:44.757Z
---

# jkwak-work driver-bug comments: the Vendor Driver Bug label is the tell (bare comment ≠ ruling)

When jkwak-work (MEMBER) comments "this is a graphics/driver bug" on a Slang issue WITHOUT adding the `Vendor Driver Bug` label, treat it as an informal remark, not a classification: on #14415 (11-09) he added the label within minutes of an identical comment, while on #14493 (11-16) "we think that it is a driver side bug" came label-free — no assignee/close action followed, and the compiler-side fix (PR #14502) merged two days later anyway. The label is the tell for a real driver-bug ruling; the bare comment is a hypothesis that shouldn't stand a chain down. Also: keep compiler-side vs cost-magnitude blame separable — an OpPhi/liveness delta measured in spirv-dis text is driver-independent regardless of who pays for it at runtime.
