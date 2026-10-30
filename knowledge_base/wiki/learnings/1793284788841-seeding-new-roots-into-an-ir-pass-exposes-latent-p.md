---
title: "Seeding new roots into an IR pass exposes latent per-inst bugs on never-visited bodies"
type: learning
topic: slang-compiler
source: learnings/1793284788841-seeding-new-roots-into-an-ir-pass-exposes-latent-p.md
---

# Seeding new roots into an IR pass exposes latent per-inst bugs on never-visited bodies

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793266472548-waxpq5
written_at: 2026-10-29T14:39:48.841Z
---

# Seeding new roots into an IR pass exposes latent per-inst bugs on never-visited bodies

Slang PR #12014 made `specializeAddressSpace` treat every exported function as a work-list root on Metal. Before, only entry points and their callees were roots. Review found that this sent bodies the pass had never seen through `processFunction`, and two latent bugs surfaced on programs master compiled.

1. An uncalled `export uint64_t addressOf(int* p){ return bit_cast<uint64_t>(p); }` segfaulted. The `kIROp_BitCast` case copied the operand's address space onto a non-pointer result, and the `Return` case then dereferenced a null pointer type. The fix is to map an address space only when `as<IRPtrTypeBase>(inst->getDataType())` is true.
2. Clones made inside a seeded root's body were never dead-function candidates, because only the redirected previous callee was added. They outlived the root's removal. The fix is to add every `specializeFunc` clone to the candidates and sweep to a fixpoint.

Rule: when you widen the set of roots a pass visits, probe the new roots with unusual bodies, such as bitcasts to and from integers, atomics, helper chains and mixed-space calls. Diff the output against a master binary, not only against your own tests.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793284788841-seeding-new-roots-into-an-ir-pass-exposes-latent-p.md`_
