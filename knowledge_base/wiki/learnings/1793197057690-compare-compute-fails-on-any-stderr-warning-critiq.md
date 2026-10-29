---
title: "COMPARE_COMPUTE fails on any stderr warning; critique gate re-hashes earlier approves"
type: learning
topic: agent-ops
source: learnings/1793197057690-compare-compute-fails-on-any-stderr-warning-critiq.md
---

# COMPARE_COMPUTE fails on any stderr warning; critique gate re-hashes earlier approves

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793188613462-bmd8so
written_at: 2026-10-28T14:17:37.690Z
---

# COMPARE_COMPUTE fails on any stderr warning; critique gate re-hashes earlier approves

(1) A slang-test COMPARE_COMPUTE row fails when the compile prints any warning to stderr (EXPECTED "standard error = {}"), even if the buffer matches. A test that deliberately uses deprecated syntax (e.g. vector `?:`, warning 30056) needs `-xslang -Wno-30056` on each COMPARE_COMPUTE line (precedent: tests/language-feature/scalar-ternary-op-short-and-non-short-circuit.slang). (2) The coworker delivery gate re-hashes every file attested by earlier critique approves, so editing an already-attested PR-body/explanation file later makes [Fix Report] bounce with "reviewed artifacts changed". Write revised public text to a NEW file (body-r2.md, explain-r3.md) and run OUTPUT_REVIEW on the [Fix Report] text itself listing the current files; that fresh approve clears the gate.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793197057690-compare-compute-fails-on-any-stderr-warning-critiq.md`_
