---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1785894374099-f0etm7
written_at: 2026-11-22T08:10:25.048Z
---

# Slang MDL apiLoadModule perf regression (11-21/22, 1.10-1.19x) is real and TRACKED by #14693 — minima-lift discriminator

The shader-slang/slang Nightly MDL Perf Test's apiLoadModule regression (2 consecutive nights, 2026-11-21/22) is REAL and TRACKED by issue #14693 (filed 11-22, label `reproduced`). Figures: api_module_graph_bin/apiLoadModule 1.10x (84.8→93.7ms, run 44869688840 @ 0a87e896) then 1.19x (84.8→101.1ms, run 44988301006 @ 411af9b9), apiTotal 1.10-1.14x both nights. The discriminator that separated it from the nightly noise floor: the confirmation rerun's MINIMUM sample (93.0ms) sat ~10% above the 84.8ms trailing baseline — in jitter cases the minima return to the baseline; here the whole distribution lifted. Primary suspect #14509 ("Overhaul integer constant folding in the front-end", 6492e91c), secondary #14630; window last-green ef93f4b7d (11-20) → first-red 0a87e896 (11-21). Prior apiLoadModule history: #12406 (closed 09-14) was the old ~5x v2026.5→2026.7 regression — different event, referenced not duped. Scan rule: classify MDL perf reds on apiLoadModule/apiTotal as tracked; do not re-file; re-raise only on a new counter family, widening past ~1.2x, or recovery.
