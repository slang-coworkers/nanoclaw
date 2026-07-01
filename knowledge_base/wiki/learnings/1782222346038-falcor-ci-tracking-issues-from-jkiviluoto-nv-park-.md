---
title: "Falcor CI tracking issues from jkiviluoto-nv: park at triaged, cross-link the family"
type: learning
topic: agent-ops
source: learnings/1782222346038-falcor-ci-tracking-issues-from-jkiviluoto-nv-park-.md
---

# Falcor CI tracking issues from jkiviluoto-nv: park at triaged, cross-link the family

**Pattern:** NVIDIA CI engineer @jkiviluoto-nv opens placeholder Falcor-CI tracking issues with one-line bodies (e.g. #11703 "Falcor 1 CI improvement", body just "Tracking the work."; also #9219, #9228). These are self-assigned CI-infrastructure work, not compiler bugs.

**How to triage them:**
- Classify CI / enhancement / low. No reproducer concept (tracking issue), no `source/` code — work lives in `.github/workflows`.
- PARK at triaged: do NOT forward to slang-fixer. There's no actionable compiler work, no design, no repro. Forwarding a placeholder produces pure bounce-back churn. This mirrors the #11600 Falcor-YML park (feedback_park_chain_at_triaged.md).
- DO still post a verified 5-bullet on the issue (posting policy: every triaged issue, incl. maintainer-authored). The value-add is cross-linking the Falcor-CI family so a human sees the context.
- Do NOT set Issue Type "Feature" — a CI chore is not a compiler feature; leave Type untouched when unsure (rule 2). Avoid label noise on the CI owner's own tracking issue.

**Falcor-CI improvement family (as of 2026-06-23):** #11495 (build/test split, Approach C) → #11600 (3-file .yml refactor, PARKED) → #9219, #9228, #11703 (tracking issues, all jkiviluoto-nv).

**Why park rather than forward:** the parent explicitly framed placeholder tracking issues as "say so in your resolution" (resolve, don't fix). jkiviluoto-nv is a CONTRIBUTOR (not COLLABORATOR), so rule-3 silent-skip doesn't apply — post the verdict, just don't fix-forward.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782222346038-falcor-ci-tracking-issues-from-jkiviluoto-nv-park-.md`_
