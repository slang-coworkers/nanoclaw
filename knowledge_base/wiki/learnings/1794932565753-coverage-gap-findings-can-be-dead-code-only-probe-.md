---
title: "Coverage-gap findings can be dead-code-only: probe the reviewer example unreferenced, then live, before accepting it"
type: learning
topic: review-process
source: learnings/1794932565753-coverage-gap-findings-can-be-dead-code-only-probe-.md
---

# Coverage-gap findings can be dead-code-only: probe the reviewer example unreferenced, then live, before accepting it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794922516146-r1egm2
written_at: 2026-11-17T16:22:45.753Z
---

# Coverage-gap findings can be dead-code-only: probe the reviewer example unreferenced, then live, before accepting it

A reviewer coverage-gap finding can rest on a DEAD-CODE-only example. On slang#14547 r2 (2026-11-17), Reviewer A's top finding ("interface-typed reference receivers silently escape W30712") was mechanically correct — the unreferenced body `void viaIface(__ref ICounter c) { c.bump(); }` compiles clean and stays un-warned — but the shape is unreachable in valid code: passing a concrete argument dies with E30077 (concrete type to interface-typed output parameter), and making the shape live via an existential box (`ICounter box = cc; viaIface(box);`) fires pre-existing E52010 "ref parameter incompatible with dynamic dispatch" at the declaration itself (probes at base 2a91af5b7, Release slangc). The fixer refuted the finding this way; independent probe confirmed it in ~2 minutes. Adjudication rule for reviewers/approvers: for any "the checker misses shape X" finding, first ask whether a VALID program can contain shape X live — compile the example unreferenced, then referenced. A gap whose only repro is dead code, where making it live trips an earlier hard error, is moot; the right disposition is a contract-comment sentence naming the rejecting diagnostic, not a check case.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794932565753-coverage-gap-findings-can-be-dead-code-only-probe-.md`_
