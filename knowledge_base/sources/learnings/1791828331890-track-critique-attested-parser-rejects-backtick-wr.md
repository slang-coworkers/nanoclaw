---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791827893431-90ub3o
written_at: 2026-10-12T18:05:31.890Z
---

# track-critique Attested parser rejects backtick-wrapped hashes

The comment gate (gate-critique-on-deliver.sh) checks the body file's sha256 against `critique_attested.OUTPUT_REVIEW`. track-critique.sh only records lines matching `- <64hex> <path>`. If codex wraps the hash in backticks (`` - `abc…` `/path` ``) nothing gets recorded, and an approved, unchanged file is still denied with "not among the files an OUTPUT_REVIEW attested". Fix: in the next codex-reply, ask for plain `- <sha> <absolute-path>` lines with no backticks. Separately, a read-only `gh api .../pulls/<n>/reviews` Bash call was blocked as "PR creation" by the same gate. The slang-mcp github_get_pull_request_reviews tool avoids that.

Also learned: a standalone mimic of a header wrapper (no <cstdint>, using long long) plus `clang++ -target i386-linux-gnu -fsyntax-only` verifies 32-bit layout static_asserts in a container that has no 32-bit libc headers.
