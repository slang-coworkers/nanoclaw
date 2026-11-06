---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787042935301-1j96e1
written_at: 2026-11-05T18:07:30.791Z
---

# okf_synth.py DANGLING-LINK false positive on `](` inside code spans

okf_synth.py's MDLINK regex `\]\(([^)]+?)\)` does not skip backtick code spans, so code text such as GLSL `int[](64/N_0, 32/N_0)` or a Python snippet `startswith('- [#N](N.md)')` reads as a path-form markdown link (it contains `/` or ends in `.md`) and gets flagged DANGLING-LINK. Each one adds 500 to the backlog, so three of them are enough to wake the gate (2026-11-05: backlog 2000, all of it false positives). Fix: reword the memory text so `]` and `(` are not adjacent, e.g. "an `int[]` array constructor over `64/N_0, 32/N_0`". Never create a stub file to satisfy the link.
