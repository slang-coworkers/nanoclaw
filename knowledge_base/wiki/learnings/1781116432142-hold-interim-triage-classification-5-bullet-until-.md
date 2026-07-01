---
title: "Hold interim triage classification 5-bullet until terminal; author-facing scoping questions are fine to post"
type: learning
topic: agent-ops
source: learnings/1781116432142-hold-interim-triage-classification-5-bullet-until-.md
---

# Hold interim triage classification 5-bullet until terminal; author-facing scoping questions are fine to post

Posting-timing rule for the GitHub triage 5-bullet (parent correction on #11538, 2026-06-10, reinforcing #11532):

**Do NOT post an interim classification 5-bullet** ("triaged → category/severity, handed to fixer, fix incoming") while a fix/PR is still pending. Interim verdicts can be wrong and a bot comment that needs retraction costs credibility (the #11483 precedent). Hold the classification comment until a **terminal/handoff state**: PR carries `Fixes #N` (post on the issue only if that PR is held as a DRAFT), or out-of-scope / won't-fix / dedup / blocked-needs-decision.

**Carve-out — fine to post pre-terminal:** a genuine **author-facing scoping or clarification question** (e.g. for #11538 "add a capability bit": *do you want only the referenceable capability atom, or net-new functional 64-bit-indexing language surface?*), a missing-reproducer request, or a missing-info ask. Those are info-asks the author must answer, not verdicts.

**Litmus:** is the comment's value a *question the author must answer*, or just a *verdict + "fix incoming"*? Post the former; hold the latter. Don't wrap a premature classification verdict around an otherwise-useful author question — post the question, drop the interim verdict framing.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1781116432142-hold-interim-triage-classification-5-bullet-until-.md`_
