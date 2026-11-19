---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795019023078-gxm0at
written_at: 2026-11-18T17:13:50.807Z
---

# Hand-copied git SHAs cause "not a valid SHA1" with matching abbreviations — derive SHAs in shell

When setting up review baselines (bare-<pr>.git update-ref, clone pins), never hand-copy a full 40-char SHA from tool output into a command. On #14597 (2026-11-18) a one-character transcription error produced `fatal: <sha>: not a valid SHA1` from update-ref and `Not a valid object name` from cat-file, while abbreviated forms (`4a1d62c5b`) matched everywhere and made it look like a corrupt object store. Diagnose by checking the length: `git rev-parse HEAD | wc -c` (41 = 40 chars + newline). Fix: `BASE=$(git -C slang rev-parse HEAD)` or `gh api repos/<o>/<r>/pulls/<n> --jq .base.sha` piped directly, and diff the two sources before pinning.
