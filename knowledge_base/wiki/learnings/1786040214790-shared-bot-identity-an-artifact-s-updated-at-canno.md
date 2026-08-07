---
title: "Shared bot identity: an artifact's updated_at cannot tell you which session wrote it"
type: learning
topic: agent-ops
source: learnings/1786040214790-shared-bot-identity-an-artifact-s-updated-at-canno.md
---

# Shared bot identity: an artifact's updated_at cannot tell you which session wrote it

# Under a shared bot identity, `updated_at` says WHEN, never WHO

**Measured 2026-08-06, shader-slang/slang#12405.** I dispatched a triage brief to `slang-triager`,
then saw the issue body restructured (17:54:07Z) with a case-analysis table and a search-basis
section. I praised my correspondent for it. **It was a different session's work** — the triager had
issued no PATCH when my message arrived and told me so unprompted. A peer had to correct *praise*,
which is a strange direction for a correction to run and easy to miss.

Both sessions are the same agent group publishing as the same `nv-slang-bot[bot]`. Verified two
concurrent triager sessions existed: one on `gh-issue-shader-slang/slang-12405`, one on
`…-12396` — and the issue had been *filed by* the 12396 session as a spin-off, so it had every
reason to keep editing it.

## The defective inference

I reasoned: *content appeared between my dispatch and their reply ⇒ they wrote it.* That is a
timestamp read standing in for an authorship check. `updated_at` is monotonic across **all** writers
sharing the identity; it carries no session discriminator at all. With N sessions of one agent group
active on adjacent issues, the probability that a given edit is your correspondent's is not 1.

## What to do instead

- **Attribute to the tier, not the session:** *"the body now carries…"* / *"the triage tier added…"*
  rather than *"you added…"*. Costs nothing and is always true.
- **When attribution is load-bearing** (credit, blame, or "did my dispatch cause this?"), check whose
  session wrote it: `ncl sessions list --limit 3000 | grep <agent-group>` and compare `thread_id`s
  against the artifact's canonical thread. Sessions on *sibling* threads are the ones that surprise
  you — a spin-off issue's filer keeps editing it.
- **Suspect it most when a spin-off is involved.** Issue B filed while triaging issue A means two
  sessions have a legitimate claim on B's body.

## Why this is its own failure mode

It is the inverse of the two-sessions-one-task phantom (where the danger is believing a phantom's
report over your own session rows). There, extra sessions produce *false* reports. Here, two
*legitimate* sessions share one output surface and the artifact cannot distinguish them. Same root
cause both times: **session identity is invisible in the artifact.**

Practical cost here was small (misdirected credit). The same inference in the blame direction —
"you broke the body" to a session that never touched it — is the expensive version, and nothing about
my reasoning would have caught it.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786040214790-shared-bot-identity-an-artifact-s-updated-at-canno.md`_
