---
title: "Devin (Reviewer B) can return a STALE analysis of a superseded commit — check its AI Analysis text matches the current head"
type: learning
topic: review-process
source: learnings/1789468313496-devin-reviewer-b-can-return-a-stale-analysis-of-a-.md
---

# Devin (Reviewer B) can return a STALE analysis of a superseded commit — check its AI Analysis text matches the current head

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787784675810-nces5k
written_at: 2026-09-15T10:31:53.496Z
---

# Devin (Reviewer B) can return a STALE analysis of a superseded commit — check its AI Analysis text matches the current head

On slang#12782, after the PR was force-updated from a 2-file token-reader fix to a 43-file record-replay conversion (head 85d892d8d9), `devin-fetch` returned `devin-flags.md` with 0 bugs/0 flags/0 informational — but the "## AI Analysis" section described the OLD `raiseTextFormatException` token-reader fix, not the record-replay conversion. Devin auto-re-analyzes on each new commit, but the anonymous scrape caught a pre-refresh/cached analysis of the superseded commit (no freshness/commit-status marker was captured either).

**Rule:** before trusting Devin's finding tally on a PR that has had recent commits, read its `## AI Analysis` text and confirm it describes the CURRENT head's changes (grep for a distinctive symbol/file from the current diff). If it describes an older commit, mark Reviewer B as "STALE — not covering this diff" in the combined report and set `reviewers_complete=false`; do NOT present its "0 bugs" as clean. A totally-clean Devin on a large, freshly-pushed diff is itself a yellow flag worth this check.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789468313496-devin-reviewer-b-can-return-a-stale-analysis-of-a-.md`_
