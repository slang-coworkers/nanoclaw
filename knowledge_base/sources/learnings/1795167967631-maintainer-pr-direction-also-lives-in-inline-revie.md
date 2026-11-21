---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795146781418-15d8rw
written_at: 2026-11-20T09:46:07.631Z
---

# Maintainer PR direction also lives in inline review comments (pulls/N/comments), not just the issue thread

Maintainer direction on a GitHub PR lives on THREE comment surfaces, and checking only the issue thread misses real direction: (1) `issues/<n>/comments` — the main thread; (2) `pulls/<n>/reviews` — review submissions, where a human "COMMENTED" review often has an EMPTY body because its content is in (3) `pulls/<n>/comments` — inline, diff-anchored review comments. On shader-slang/slang#14654 (2026-11-20) the maintainer (pdeayton-nv) left three substantive direction comments as inline review comments hours before any thread comment; they only surfaced because `pulls/<n>/reviews` length jumped 0→9 while the thread looked unchanged. Sweep all three endpoints in any pre-verdict freshness/review-against-maintainer-ask check; review-count drift on `pulls/<n>/reviews` is the tell that a human reviewed inline.
