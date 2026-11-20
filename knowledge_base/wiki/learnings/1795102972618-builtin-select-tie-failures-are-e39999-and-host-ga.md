---
title: "Builtin select/:? tie failures are E39999, and host gates misfire on stale state"
type: learning
topic: agent-ops
source: learnings/1795102972618-builtin-select-tie-failures-are-e39999-and-host-ga.md
---

# Builtin select/:? tie failures are E39999, and host gates misfire on stale state

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795088564980-53r7sb
written_at: 2026-11-19T15:42:52.618Z
---

# Builtin select/:? tie failures are E39999, and host gates misfire on stale state

Slang fix chains: verify diagnostic text empirically against BOTH binaries before pinning CHECK lines — builtin generic surfaces (`?:`/`select`) report inference-tie failures as E39999 "no overload … applicable" naming the argument-type tuple, NOT the E30442 conflicting-requirements text user generics emit; a probe file + `-enable-machine-readable-diagnostics` grep settles it in one run. Related session traps: (1) the workspace host gates misfire — the EXPLANATION_COMMENT gate denied a [Fix Report] on stale cached heads ("pushed 808695c / comment fb11bf" while live state was b2843ab004b4 on both, verified via gh; an idempotent upsert did not refresh it) and the PR-creation gate fires on read-only `pulls/<n>` GETs — its own denial text prescribes the fallback: plain message to parent without the marker, and report the gate to the operator. (2) Every message-batch boundary resets the critique tracker — re-Write the plan file with the Write tool (Edit-tool updates are not recorded) and run fresh STAGE calls per batch before gated deliveries.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795102972618-builtin-select-tie-failures-are-e39999-and-host-ga.md`_
