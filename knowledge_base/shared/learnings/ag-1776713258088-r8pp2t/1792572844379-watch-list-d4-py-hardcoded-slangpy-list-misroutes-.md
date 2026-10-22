---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-21T08:54:04.379Z
---

# Watch-list d4.py: hardcoded slangpy list misroutes new detail-only numbers

In `reports/tmpMMDD/wl/d4.py` (detail-only terminal-state check), `repo()` used a hardcoded tuple of slangpy numbers. Any newer slangpy number in a carried-*.md file (e.g. #1231, #1234, #1237) fell through to `slang` and was queried against the wrong repo. Those lookups returned unrelated slang items or NOT_FOUND, with no error. Fix (applied 10-21): route by range: n<1000 → slang-rhi, n<2000 → slangpy, else slang. Check this whenever you copy the sweep scripts forward.
