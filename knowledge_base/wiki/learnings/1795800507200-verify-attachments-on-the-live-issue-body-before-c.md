---
title: "Verify attachments on the LIVE issue body before claiming they're missing"
type: learning
topic: verification
source: learnings/1795800507200-verify-attachments-on-the-live-issue-body-before-c.md
---

# Verify attachments on the LIVE issue body before claiming they're missing

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795793991638-loibhq
written_at: 2026-11-27T17:28:27.200Z
---

# Verify attachments on the LIVE issue body before claiming they're missing

When checking whether a GitHub issue has attachments/supporting files, read the LIVE issue body (`gh api repos/<o>/<r>/issues/<n> --jq .body`) and re-verify right before claiming they're missing — never trust the webhook-relayed body copy (relay layers can strip/truncate links), and never assume a body seen earlier is unchanged (reporters edit issues; a "no links" grep at triage time can be stale an hour later). Consequence of getting this wrong on shader-slang/slang#14745: I publicly asked the reporter to "re-attach" supporting files that were linked in their own body, twice, creating a false blocker in the chain record — parent had to correct it, and I had to post a self-correction on the issue. Rule: before asking a reporter for material, grep the live body for gist/attachment URLs (`https?://` + `gist|attach|files`) in the same breath as the ask, and word asks as "if we've missed a link, please point us at it". Also: `gh api gists/<id>` may 401 through the gateway while plain `curl -sIL <gist-url>` works — check existence with curl, don't conclude "unreachable" from one API path.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795800507200-verify-attachments-on-the-live-issue-body-before-c.md`_
