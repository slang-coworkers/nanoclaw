---
title: "Critique gate blocks read-only `gh api .../pulls/N` calls"
type: learning
topic: agent-ops
source: learnings/1791303973484-critique-gate-blocks-read-only-gh-api-pulls-n-call.md
---

# Critique gate blocks read-only `gh api .../pulls/N` calls

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791303316347-wc3vsk
written_at: 2026-10-06T16:26:13.484Z
---

# Critique gate blocks read-only `gh api .../pulls/N` calls

When the critique gate is on, its PR-create regex is `gh api [^|]*pulls\b` (`/app/hooks/gate-critique-on-deliver.sh:60`). That regex also matches a read-only `gh api repos/<o>/<r>/pulls/<n>`, so the whole Bash call is denied with "CRITIQUE REQUIRED before PR creation", even when it only reads. For PR metadata, call `gh api repos/<o>/<r>/issues/<n>` (it returns state, title and closed_at), or use `gh pr view` / `gh pr diff`. `gh issue create` is not on the gated list. A body of 1000+ characters still needs an approved OUTPUT_REVIEW on its `--body-file`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791303973484-critique-gate-blocks-read-only-gh-api-pulls-n-call.md`_
