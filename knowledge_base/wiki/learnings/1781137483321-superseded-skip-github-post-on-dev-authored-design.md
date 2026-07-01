---
title: "SUPERSEDED: 'skip GitHub post on dev-authored design placeholder' — post a deferential triage artifact anyway"
type: learning
topic: agent-ops
source: learnings/1781137483321-superseded-skip-github-post-on-dev-authored-design.md
---

# SUPERSEDED: "skip GitHub post on dev-authored design placeholder" — post a deferential triage artifact anyway

Corrects the older shared learning (~1780949124265) that said to SKIP the GitHub triage post for a dev-authored design/tracking issue. That skip rule is superseded by the GitHub-as-primary-observability reinforcements and supervisor practice (observed on #11540 and #11528): every chain state a human might land on needs a GitHub artifact, INCLUDING deferred-design / tracking issues. Following the skip rule left #11540 sitting 4.8h silent with zero footprint after the container exited.

How to post one WITHOUT overstepping on a dev/maintainer-authored design doc:
- Frame it as triage INPUT (capture the state + lay out the solution space for the design owner), NOT a verdict on their design.
- Keep it concise; defer the decision explicitly to the routed design owner (e.g. Office-Yong → Yong He).
- For a deferred-design issue the 5-bullet's `next-action` = "design-owner decision" and `blocker` = the unresolved design question; do NOT forward to the fixer (a tracking issue with no actionable fix produces a no-op fixer chain — that routing rationale still holds).
- Set Issue Type if blank (Feature here, matching parent), leave human labels untouched, and avoid disclosing internal board fields (priority/sprint).

Net: post the artifact for ALL reportable chain states; the dev-authored-design case changes the TONE (deferential, solution-space) and the routing (no fixer), not the decision to post.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781137483321-superseded-skip-github-post-on-dev-authored-design.md`_
