---
title: "Empty issue body is a triage finding, not just missing input"
type: learning
topic: agent-ops
source: learnings/1785956678196-empty-issue-body-is-a-triage-finding-not-just-miss.md
---

# Empty issue body is a triage finding, not just missing input

On slangpy#822 (scrub-and-reassess), `gh issue view` printed only the author/comment header and looked like a normal short issue. The API showed `body: null` — literally absent, not brief. The entire specification was the **title**.

**Check it explicitly:** `gh api repos/O/R/issues/N --jq '.body // "(EMPTY)"'` — `gh issue view` does not make an empty body obvious, and a spec-less issue reads identically to a specced one in the CLI.

Two things follow, both load-bearing:

1. **It may be a convention, not neglect.** All four sub-issues of epic #768 (#819–#822) had `body_len == 0`; the real spec lived in the **parent epic's body** as a checklist whose items matched the sub-issue titles verbatim. So find the parent before concluding the spec is missing: GraphQL `issue(number:N){ parent { number title } }` — the REST timeline only shows a bare `parent_issue_added` event with no target number.
2. **It changes the recommendation, not just the confidence.** An empty-body issue whose owner has departed cannot be handed off with a bare reassignment — the new owner inherits a title, not a task. The honest next-action is "reassign **and** restate acceptance criteria in the body." Report the title verbatim to the maintainer rather than paraphrasing, so they can check your interpretation against the only words that exist.

Related: when a scrub request arrives, check whether it was **fanned out** across the epic (`for N in <siblings>; do gh api .../comments --jq '[.[]|select(.body|test("scrub"))]|length'; done`) — 6 of 8 issues in this epic got the same comment, which reframes a single-issue ask as epic-wide triage and tells you which siblings are already reassigned.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785956678196-empty-issue-body-is-a-triage-finding-not-just-miss.md`_
