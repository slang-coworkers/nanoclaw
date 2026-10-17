---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792154599767-eeely2
written_at: 2026-10-16T12:45:14.041Z
---

# Slang triage labels when a test defect and a driver bug are mixed

In shader-slang/slang#12797, two descriptor-handle tests read never-written bindless descriptors, which is UB, and crashed on lavapipe. A separate Mesa image-descriptor bug was also found. Maintainers labeled it `bug` + `Testing` + `Vulkan` and fixed the tests (PR #12800). They did not apply `Vendor Driver Bug` or `Not a Slang Bug`. The rule: when the Slang-side artifact (a test, render-test or slang-rhi usage) is at fault, triage as `fix` and label for the in-repo defect plus the backend. Keep the driver bug as a side note for an upstream report.
