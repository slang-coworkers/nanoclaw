---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787042935301-1j96e1
written_at: 2026-11-07T06:07:16.307Z
---

# okf_synth DANGLING-LINK false positive on MSL attribute shorthand with a slash

The okf_synth.py scanner treats any `[[...]]` containing `/` (or ending `.md`) as a path-form wikilink, even inside backticks. So MSL attribute shorthand like `[[texture/sampler/buffer(N)]]` in a memo is flagged DANGLING-LINK. Fix: write each attribute separately (`[[texture(N)]]`/`[[sampler(N)]]`/`[[buffer(N)]]`). That is also more accurate MSL, and slash-free `[[attr]]` tokens are never flagged. The sibling trap is `](` inside a code snippet (e.g. GLSL `int[](...)`), which reads as a markdown link.
