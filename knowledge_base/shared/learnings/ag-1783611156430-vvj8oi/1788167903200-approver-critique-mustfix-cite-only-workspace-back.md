---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788165739295-8ry0mv
written_at: 2026-08-31T09:18:23.200Z
---

# [approver/critique-mustfix] cite only workspace-backed evidence; don't claim Devin is "head-current" on the Devin-only tier

**Context:** clean WOULD_APPROVE on a CI-config-only PR (slang#12811, Devin-only fallback tier, harvest exit 20). The codex critique gate (DECISION_REVIEW + OUTPUT_REVIEW) issued two corrections that recur across approvals — both about the derivation asserting more than the on-disk artifacts support.

**1 — OUTPUT_REVIEW must-fix: the critique reviewer only sees workspace files, not your MCP query results.**
- Symptom: the `[Approval Decision]` message said "human maintainer already approved (jvepsalainen-nv, LGTM)". I had verified this via `mcp__slang-mcp__github_get_pull_request_reviews`, but that result lived only in my context, not on disk. Codex (read-only, reads only the paths you hand it) flagged the claim as unsupported → must-fix.
- Root cause: the delivery gate re-hashes the artifacts codex attested; any decision-message claim must be traceable to a file in `work/<pr>-<sha12>/`. An MCP/tool result you didn't persist is invisible to the critique and therefore "unsupported."
- How to catch it: before OUTPUT_REVIEW, for every factual claim in the decision message ask "which staged file backs this?" If a claim rests on an MCP query (human review state, CI status, PR metadata), write that result to a small evidence file (e.g. `review/human-reviews.json`) and cite it. Mode `live_late` in particular means a human review exists — capture it, don't assert it from memory.
- Fix: persist MCP-fetched evidence to the workspace and cite the path.

**2 — DECISION_REVIEW advisory: on the Devin-only tier, "head-current" overstates Devin's freshness.**
- Symptom: review-doc called Devin "head-current". Devin's captured commit-status freshness was `unknown` (agent-browser drives Devin by PR URL, which doesn't prove it pinned the exact head SHA).
- Correct framing: don't assert head-current from the Devin run alone. Assert what you can prove — the change Devin analyzed matches the pinned head's diff (compare against `tmp/pr.diff`) — and lean on Step-1 `commit_match`, which passes because the Devin-only tier writes `commit_id = commit_sha`. That combination, not a freshness claim, is the real evidence the review covers the pinned head.

**Transferable rule:** the approver's audit trail is only as strong as its staged files. Every decision-relevant claim must be backed by a file the critique can hash; MCP results and "head-current" for URL-driven Devin are the two spots that habitually aren't. Neither correction changed the WOULD_APPROVE outcome — both tightened the derivation, which is exactly the critique gate's job.
