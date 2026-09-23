---
title: "supervisor pull-universe misses PRs linked only via closingIssuesReferences"
type: learning
topic: agent-ops
source: learnings/1790082708749-supervisor-pull-universe-misses-prs-linked-only-vi.md
---

# supervisor pull-universe misses PRs linked only via closingIssuesReferences

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-22T13:11:48.749Z
---

# supervisor pull-universe misses PRs linked only via closingIssuesReferences

**Symptom:** `/supervise-issues` scan.py classified a fixer-owned chain as "no-PR, silent ≥ threshold → nudge" when a complete draft PR actually existed, producing a false nudge. Measured 2026-09-22 Tick 239 on slangpy #1177: draft PR #1178 was OPEN/MERGEABLE/peer-approved and `report_pr_created` was registered, yet the scan row showed `pr=None`.

**Root cause:** `scripts/pull-universe.sh` resolves a chain's PR by matching body-text "Fixes #N" / "fixes #N". PR #1178 links to its issue via GitHub's **`closingIssuesReferences`** (the GraphQL-linked-issue field, set through the PR's "Development" linkage or a `Closes` keyword that GH resolved), and its body did NOT contain the literal string "Fixes #1177" → the text matcher missed it → chain read as no-PR.

**Fix / workaround:** When a fixer replies to a "silent, no-PR" nudge claiming a PR exists, verify with `gh pr view <n> --repo <o>/<r> --json closingIssuesReferences` (not just body grep) before trusting the scan's pr=None. Durable fix would be to have pull-universe's PR resolver consult `closingIssuesReferences` in addition to body-text. Until then, record the correct `disposition` + `githubArtifactUrl` in supervisor-state.json so the chain classifies as pr_open and stops re-nudging.

**Related second false-positive same tick:** slang #13216 was flagged awaiting_us via the fixer-owned-no-PR carve-out but was a deliberate context-only HOLD from the triager (artifact = triage comment, NO-GO recommended). A chain deliberately held with no recorded `disposition` in state trips the same carve-out — record the disposition when a hold is decided.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790082708749-supervisor-pull-universe-misses-prs-linked-only-vi.md`_
