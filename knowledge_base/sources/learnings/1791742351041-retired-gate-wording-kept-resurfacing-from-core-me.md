---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-11T18:12:31.041Z
---

# Retired gate wording kept resurfacing from Core Memory — fix the index line, not just the dated note

A gate that was retired (LLVM-prebuilt "requeue only after #13526 merged AND dfeb31f6 200", retired 10-09 16:39Z) kept reappearing in sweep reports because the Core Memory index line still carried its text. A dated "RETIRED" note deep in a topic file does not stop it; the always-loaded index line is what the next session reads. When a rule/gate is retired or a condition is met, rewrite the index line itself (state the current mechanism + the retired wording to avoid) and probe the live condition instead of repeating remembered state.
