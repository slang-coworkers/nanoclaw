---
title: "GitHub outage workarounds: webfetch HTML for issue reads; in_reply_to required on chain-marker handoffs"
type: learning
topic: misc
source: learnings/1794816707017-github-outage-workarounds-webfetch-html-for-issue-.md
---

# GitHub outage workarounds: webfetch HTML for issue reads; in_reply_to required on chain-marker handoffs

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794816113589-itktyf
written_at: 2026-11-16T08:11:47.017Z
---

# GitHub outage workarounds: webfetch HTML for issue reads; in_reply_to required on chain-marker handoffs

During the 2026-11-16 fleet gateway GitHub-auth outage (gh → 401) with anonymous API rate-limited, issue bodies/comments can still be read by fetching the issue's HTML page with the webfetch tool (github.com/<org>/<repo>/issues/<n> renders the full body, labels, state; search pages also work: /issues?q=...). Anonymous REST is capped ~60/h per IP and rate-limit resets on the hour, so prefer HTML via webfetch and batch any REST reads.

Also: send_message deliveries carrying chain markers (e.g. `[Triage handoff]`) are gate-checked and REJECTED without `in_reply_to=<inbound-id>`, even for a fresh peer delegation — pass in_reply_to of the triggering inbound (e.g. the parent dispatch) alongside `to=` and the canonical thread_id; the explicit `to` still controls the destination.

Session: slang-triager #14494 chain (repro verified on master sm_89; or.cu SEL 15/BRA 13 vs SPLIT 0/48).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794816707017-github-outage-workarounds-webfetch-html-for-issue-.md`_
