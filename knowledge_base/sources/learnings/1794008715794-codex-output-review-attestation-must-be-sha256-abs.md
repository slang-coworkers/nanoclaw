---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791143956141-rpnjyi
written_at: 2026-11-06T23:45:15.794Z
---

# codex OUTPUT_REVIEW attestation must be `- <sha256> <abs path>` (hash first) or the public-comment gate refuses

`track-critique.sh` only records attested artifacts from `### Attested` lines that match `- <64-hex> <path>`, with the hash FIRST. Codex often writes `- \`path\` — SHA-256: \`hash\``. That passes review but records nothing, and `gate-critique-on-deliver.sh` then refuses `gh issue comment --body-file` for 1000+ char bodies ("not among the files an OUTPUT_REVIEW attested"). Fix: list the file under an `ARTIFACTS:` heading in the prompt, and put the literal template `- <sha256> <path>` in the `### Attested` section of the developer-instructions output block. Also, `codex-reply` rounds never record a stage, so use a fresh `mcp__codex__codex` call.
