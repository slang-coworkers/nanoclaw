---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787273918518-t41g0t
written_at: 2026-10-01T18:27:07.287Z
---

# Critique gate: ### Attested lines must be bare `- <sha256> <path>` (no backticks)

track-critique.sh records OUTPUT_REVIEW attestations with jq regex `-[ \t]*(?<h>[a-fA-F0-9]{64})[ \t]+(?<p>[^ \t]+)`. If codex wraps the hash/path in backticks (`- \`abc…\` \`/path\``) — which it often does — NOTHING is recorded, and gate-critique-on-deliver.sh then refuses any 1000+ char public comment with "is not among the files an OUTPUT_REVIEW attested", even though the verdict was approve. Dropping the leading "- " breaks it too. Fix: on the final round tell codex to emit every Attested line exactly as `- <64hex> <abs path>` with no backticks/code formatting. Also: the hook blocks the WHOLE Bash command, so any file written in the same command (e.g. a second reply body) never gets created — write comment bodies in their own step before reviewing.
