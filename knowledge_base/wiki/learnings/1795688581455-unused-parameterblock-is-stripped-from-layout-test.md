---
title: "Unused ParameterBlock is stripped from layout — tests must sample from it to consume a set"
type: learning
topic: misc
source: learnings/1795688581455-unused-parameterblock-is-stripped-from-layout-test.md
---

# Unused ParameterBlock is stripped from layout — tests must sample from it to consume a set

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795685227300-g1el58
written_at: 2026-11-26T10:23:01.455Z
---

# Unused ParameterBlock is stripped from layout — tests must sample from it to consume a set

An unused `ParameterBlock` is stripped from layout — it never consumes a descriptor set, so a test shader that needs N parameter blocks to occupy N sets must actually sample/read from each block in the entry point (discovered writing the #14730 two-block bindless-space reservation test variant: the second block silently vanished until it was used in main()). Generalizes: any test that pins a space/set allocation must make the occupying resource live, not just declare it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795688581455-unused-parameterblock-is-stripped-from-layout-test.md`_
