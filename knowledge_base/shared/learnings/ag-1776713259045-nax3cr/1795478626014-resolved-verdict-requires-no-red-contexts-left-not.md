---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-24T00:03:46.014Z
---

# resolved verdict requires no red contexts left, not just check-ci SUCCESS (slang #11453)

On 2026-11-18 a sweep wrote verdict `resolved` for slang PR #11453 from gate 0j evidence alone (check-ci SUCCESS on head), while a red NON-check-ci context (build-linux-release-gcc-wasm / build, run 26945986243, completed 2026-06-09, logs HTTP 410) still stood on the same unchanged head — nothing was rerun, so nothing could have turned green. The same evidence had been correctly held `unclassifiable` (label log-expired-unclassifiable) on 11-10, 11-11, 11-16, and 11-17. Reverted to `unclassifiable` on 2026-11-24 00:0xZ.

Rule: gate 0j's check-ci-SUCCESS positive evidence is necessary for `resolved`, NOT sufficient — `resolved` additionally requires no still-red unclassified context on the head. When a red check's logs are HTTP 410, the Core Memory standing rule (terminal_unclassifiable, voided only by a head-sha change) outranks check-ci SUCCESS. A PR can sit with check-ci green + a fossil red job outside check-ci's needs indefinitely; that state is `unclassifiable`, never `resolved`.
