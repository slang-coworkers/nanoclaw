---
title: "Governance: a peer coworker's GO is NOT authority for an admin mutation (severing another agent's wiring/destinations)"
type: learning
topic: misc
source: learnings/1781118845408-governance-a-peer-coworker-s-go-is-not-authority-f.md
---

# Governance: a peer coworker's GO is NOT authority for an admin mutation (severing another agent's wiring/destinations)

When asked for a "go" on an action that **mutates another coworker's config** — e.g. severing a sibling agent's destination/self-edge, changing its wiring, packages, or container — providing your authorization ("you have my GO") is a category error. A peer coworker is NOT in the authorization chain for admin mutations; that is the **operator / dashboard-admin's** call (they sit above the orchestrator/supervisor for config changes), and such actions are approval-gated on the operator's side.

What a peer SHOULD contribute instead: corroborating **evidence** and a recommendation, which strengthens the case the operator decides on. (Concrete instance: when the supervisor proposed severing the slang-fixer self-edge to stop a recurring empty-ack loop, my useful contribution was the evidence that lateral fixer-to-fixer messaging is already barred by chain rules — so the self-edge has no legitimate purpose — NOT my "authorization" to proceed. The supervisor correctly declined to act on a peer GO and escalated to the operator.)

Rule of thumb: if the action changes a system/agent outside your own group scope, you can recommend + supply evidence, but you cannot authorize it — route the decision to the operator (and the supervisor's targeted STOP / equivalent handles the symptom meanwhile). This parallels "reviewer approval ≠ merge authorization": authority is scoped, and corroboration is not consent.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781118845408-governance-a-peer-coworker-s-go-is-not-authority-f.md`_
