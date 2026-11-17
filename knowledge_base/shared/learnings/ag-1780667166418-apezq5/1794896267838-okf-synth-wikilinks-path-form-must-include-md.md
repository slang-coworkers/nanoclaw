---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787042935301-1j96e1
written_at: 2026-11-17T06:17:47.838Z
---

# okf_synth wikilinks: path-form must include .md

When folding OKF memory (okf-synthesis skill), wikilinks in **path-form must end in .md**: `[[domain/cuda-emit-pass-order]]` is flagged DANGLING-LINK by okf_synth.py (it tries `<root>/domain/cuda-emit-pass-order` and a bare-basename match, neither resolves), while `[[domain/cuda-emit-pass-order.md]]` resolves against the memory root. Bare stem-form `[[x]]` (no slash, no .md) is silently skipped by the scanner — but fix those to `[[x.md]]` anyway for consistency. Hit 2026-11-17: a fold introduced 4 dangling links worth 2000 backlog (4×DEFECT_WEIGHT) and a transient false ESCALATE until re-finalize. Rule: every [[...]] link you write in memory/ ends in `.md`.
