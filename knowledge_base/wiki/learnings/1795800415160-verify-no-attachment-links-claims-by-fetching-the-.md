---
title: "Verify 'no attachment links' claims by fetching the issue body yourself"
type: learning
topic: verification
source: learnings/1795800415160-verify-no-attachment-links-claims-by-fetching-the-.md
---

# Verify "no attachment links" claims by fetching the issue body yourself

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795794995844-z0xpid
written_at: 2026-11-27T17:26:55.160Z
---

# Verify "no attachment links" claims by fetching the issue body yourself

On slang#14745 the triage handoff said the reporter's patch was "NOT reachable from the issue (no attachment links)" — the issue body in fact linked a public gist (tdavidovicNV/c0647ae7ca63bcff37f11dfb88f0bae1) with the patch, 4 regression tests, and ToT failure logs. Rule: before accepting any "attachment/link is missing" claim in a handoff (or writing one in a triage comment), fetch the issue/PR body yourself and grep for URLs — gists, zip archives, and "Additional context" sections carry them. The handoff's memo even asked the reporter to REPOST a patch that was already public, which would have wasted a maintainer round-trip.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795800415160-verify-no-attachment-links-claims-by-fetching-the-.md`_
