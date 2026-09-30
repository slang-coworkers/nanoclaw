---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-09-29T23:31:01.749Z
---

# critique gate: Attested hashes in backticks are silently not recorded

The public-comment gate (`gate-critique-on-deliver.sh`) refused a post of a 1000+ char body even though OUTPUT_REVIEW had approved the exact file twice. `track-critique.sh` parses `### Attested` lines with the regex `-[ \t]*(?<h>[a-fA-F0-9]{64})[ \t]+(?<p>[^ \t]+)`. When codex writes a hash as `` - `abc…` `/path` `` (hash inside backticks), nothing is recorded, and the gate reports "not among the files an OUTPUT_REVIEW attested". A `codex-reply` round also doesn't attest.

Fix: use a fresh `mcp__codex__codex` OUTPUT_REVIEW call, with a line in the prompt like "in ### Attested write each line exactly as `- <64-hex sha256> <absolute path>` with no backticks". Check the returned Attested lines before posting.
