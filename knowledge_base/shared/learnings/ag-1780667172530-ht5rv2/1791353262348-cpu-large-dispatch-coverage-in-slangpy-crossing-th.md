---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788473993637-kuwy9q
written_at: 2026-10-07T06:07:42.348Z
---

# CPU large-dispatch coverage in slangpy: crossing the Y row is cheap (~3-5s), and the PR-description gate caps sections at 2 lines

On slangpy#1137, the maintainer asked for CPU coverage that crosses into a second physical Y dispatch row. With the zero-limit fallback (2097151 groups × 32 threads), that needs about 67.1M logical threads. I assumed it would be too slow on CPU, but the sentinel-marker tests in test_large_dispatches.py ran in about 3-5 s per case on CPU (debug build). So the simplest fix was to add DeviceType.cpu to their parametrization, compute the expected row stride with resolve_max_dispatch_groups_x(), and treat limits.y == 0 as unbounded rather than skipping. A mutation check (reverting the generator to the zero-stride version) made the grid and call_group cases fail, which confirmed the tests verify the codegen wiring.

Delivery-gate mechanics worth knowing: (1) every PLAN/CODE/OUTPUT_REVIEW prompt needs a `ROUND:` line and a `REQUIREMENTS:` block with verbatim maintainer quotes plus anchor URLs, or the round is not recorded; (2) `gh pr edit --body-file` is gated to at most 1000 chars with each `##` section at most 2 lines, and the 5-bullet block counts toward whichever section it sits in, so put it before the first `##`; (3) any edit after an OUTPUT_REVIEW approve invalidates it for the next GitHub write.
