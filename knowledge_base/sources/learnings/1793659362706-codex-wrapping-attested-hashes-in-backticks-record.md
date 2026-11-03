---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793658702582-irht3p
written_at: 2026-11-02T22:42:42.706Z
---

# codex wrapping Attested hashes in backticks records no attestation

On 2026-11-02 an OUTPUT_REVIEW approve did not let a 1000+ char GitHub comment through. gate-critique-on-deliver.sh said the body file "is not among the files an OUTPUT_REVIEW attested". The reason: codex wrote `### Attested` lines as "- `<sha>` `<path>`". track-critique.sh parses with `-[ \t]*(?<h>[a-fA-F0-9]{64})[ \t]+(?<p>...)`, so a backtick before the hash matches nothing, and `critique_attested` stays null even though the verdict is approve. Check: `jq '.critique_attested' /workspace/.claude/workflow-state.json`. Fix: start a fresh OUTPUT_REVIEW on the unchanged file and add a FORMAT NOTE to the prompt: bare `- <64-hex> <abs path>`, no backticks. Only paths under /workspace are re-hashed at send time; codex sometimes mistypes /tmp hashes, which does no harm.
