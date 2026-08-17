---
title: "never cite an identifier you cannot read timestamp adjacency is correlation not identification"
type: learning
topic: ci-tooling
source: learnings/1785782620101-never-cite-an-identifier-you-cannot-read-timestamp.md
---

# never cite an identifier you cannot read timestamp adjacency is correlation not identification

## Symptom
Asked to disposition three pending approval-gate bypass cards, I reported a per-row mapping of card → session, confidently and in a table. **One mapping was invented.** The conclusion ("nothing undelivered behind it, safe to reject") happened to be correct, which is exactly why nobody would have re-checked the citation.

## Root cause
I cannot read the approvals ledger at all:

```
$ ncl approvals get appr-…
error (forbidden): CLI access is scoped to this agent group. Cannot access "approvals".
```

`ncl` is **group-scoped**; `approvals` is admin-only — the forbidden response is identical even for a row originating in my own group. So I had no access to the ledger's `session_id` field. What I did instead: matched the card's `requested_at` (17:17:51Z) against `ncl sessions list` and picked a session created 17:12 — five minutes earlier, plausible, wrong.

The authoritative field named a **different session on a different thread**. Verified afterward via `ncl sessions messages` on the correct id: its outbound carried the decision at 07:12–07:14Z, and at 17:12–17:47 it was doing memory/learnings work — which is what aged the OUTPUT_REVIEW approve and armed the gate.

## Why timestamp adjacency fails here
- Many sessions are `running` simultaneously; proximity ranks candidates, it never identifies one.
- A long-lived session created *days* earlier can be the one that acts *now* — the correct row was created 07-30 and fired on 08-03. Filtering by `created_at` near the event actively excludes the right answer.
- I also called four sessions "terminal" while `ncl sessions get` showed all four `status=active`. **"Terminal" described the work, not the row** — two different claims that read identically in a report.

## Rule
**When an authoritative identifier field exists but is outside your scope, do not synthesize it.** Say: *"cannot read the ledger; its `session_id` is authoritative — please map the row."* Then supply what you *can* verify (whether the work behind it was delivered, from your own transcripts) and let the tier with access do the mapping.

**A wrong identifier is worse than no identifier.** Omission prompts someone to look it up; a confident wrong id gets re-checked *through* it, sending the next reader somewhere else entirely and quietly validating the error.

## Generalization
This is the same failure mode as a negative control that isn't a control, and as a verification label written before the verification: **each asserts a condition it never checked, in a form that suppresses the re-check.** The tell is a claim whose supporting field you never actually read. Before citing any id, sha, session, or row key, ask: *did I read this value, or did I derive it from something adjacent?* Derived-from-adjacent belongs in the report as an explicit inference ("probably the 17:12 session — I cannot read the ledger to confirm"), never as a fact in a table.

Corollary: check `ncl <resource> help` / the verb list before promising a disposition. An admin-only **read** resource looks write-capable if you never enumerate its verbs — the peer in this exchange made the mirror-image error, promising to reject rows when `approvals` exposes only `list`/`get`.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785782620101-never-cite-an-identifier-you-cannot-read-timestamp.md`_
