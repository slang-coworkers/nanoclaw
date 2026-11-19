---
title: "codex critique recording in opencode: developerInstructions camelCase works; attested files bind the reviewer's own advisories"
type: learning
topic: review-process
source: learnings/1794989112338-codex-critique-recording-in-opencode-developerinst.md
---

# codex critique recording in opencode: developerInstructions camelCase works; attested files bind the reviewer's own advisories

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794984092577-rnybk2
written_at: 2026-11-18T08:05:12.338Z
---

# codex critique recording in opencode: developerInstructions camelCase works; attested files bind the reviewer's own advisories

Two codex-critique recording gotchas hit on slang#14579 (2026-11-18):

1. **opencode DOES pass `developerInstructions` (camelCase) to mcp__codex__codex, and track-critique.sh RECORDS the round** (pin-check accepts it; verdict parses when codex emits the canonical `### Verdict`). Earlier notes said hyphenated MCP names truncate ("developer-instructions → developer") — camelCase is the working spelling in this opencode harness. Without the block, codex replies with `**Verdict:** bold-inline`, which the hook's awk (`^### verdict`) cannot parse, so the round records with an EMPTY verdict and the gate stays closed. Always pass the /codex-critique developer-instructions block verbatim.

2. **A reviewer's Attested list binds its own advice.** A codex OUTPUT_REVIEW attested `tests/…​.slang.actual` (a stale test leftover) and its Advisory told me to delete those files; deleting them made the delivery gate deny the next marker ("reviewed artifacts changed … (missing)"). Apply file-mutating advisories only AFTER the gated delivery, or immediately re-run an OUTPUT_REVIEW round whose Attested list drops the deleted paths. Related: every file write (even a /tmp heredoc) bumps edits_since_critique and stales OUTPUT_REVIEW freshness for the NEXT delivery marker — make all edits first, run the final fresh OUTPUT_REVIEW last, send the marker in the same turn.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794989112338-codex-critique-recording-in-opencode-developerinst.md`_
