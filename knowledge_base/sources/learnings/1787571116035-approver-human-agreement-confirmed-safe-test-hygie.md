---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787556350431-roezba
written_at: 2026-08-24T11:31:56.035Z
---

# [approver/human-agreement] CONFIRMED-SAFE: test-hygiene PR loosening only declaration specifiers (keeping the claim-carrying subject tight) → merged unchanged

**Outcome join.** shader-slang/slang#12705 — my decision WOULD_APPROVE @ a992e3bbecee. PR **merged unchanged** 2026-08-24T11:29:47Z by the author (jvepsalainen-nv), single commit, merge head == my decided commit exactly (no interval commits to diff). Merged ⇒ APPROVED-equivalent ⇒ **agreement** with my call. (Host auto-joins the human verdict from GitHub; there is no `record_human_verdict` tool in this environment — `record_decision`'s own doc says the outcome is joined automatically.)

**Transferable shape (sharpens Step-0 recall).** A PR that LOOSENS FileCheck `CHECK` patterns is normally the direction that can mask regressions, so it earns scrutiny — but the safe-vs-unsafe line is crisp and mechanical:
- **Safe to approve** when the loosening is confined to *scaffolding* — declaration specifiers/qualifiers adjacent to the subject (`__device__`, `__global__`, `__noinline__`, `inline`, `static`, `precise`) or decorations the anchored claim never mentions — AND the claim-carrying *subject* token stays tight. Test: for each removed token ask "if this token changed, would the anchored claim (the test's `//META: doc_ref`) be false?" If no, removing it only deletes a false-negative on unrelated compiler changes; it CANNOT make a false claim pass.
- The **decisive check** is subject-tightness: here the by-value subject `(int val_N)` (no `*`/`&`) and by-pointer `(int {{.*}}val_N)` + `*val_ =` deref stayed pinned, so the parameter-direction claim remained fully asserted. That is what makes loosening the scaffolding harmless — the exact distinction the PR's own new "rule 8 (relevance vs volatility)" encodes.
- **Corroborating signals that this shape is safe:** (a) the loosened specifier is still covered by a dedicated test elsewhere (`__device__` by `tests/cuda/noinline.slang`); (b) the change is a *regeneration* traceable to a real emitter change (#12419 added `__device__ __noinline__`), not a hand-weakening to force green; (c) production review + Devin both Clean.

**Contrast — when the SAME surface (a loosening PR) is NOT safe:** if the removed/wildcarded token is the subject that carries the claim (e.g. dropping `*`/`&` from a parameter, wildcarding the opcode/decoration under test), that is rule-6 weakening and routes to ABSTAIN/BLOCK. "Loosen the scaffolding, never the subject." So the probe is not "does it loosen?" but "does it loosen the SUBJECT or the SCAFFOLDING?"
