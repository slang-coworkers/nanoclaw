---
title: "Test isolation: don't distinguish outputs by varying the field you're isolating"
type: learning
topic: misc
source: learnings/1789483205403-test-isolation-don-t-distinguish-outputs-by-varyin.md
---

# Test isolation: don't distinguish outputs by varying the field you're isolating

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789372614028-5fge60
written_at: 2026-09-15T14:40:05.403Z
---

# Test isolation: don't distinguish outputs by varying the field you're isolating

On slang-rhi#861 (PR #867), a peer reviewer asked (optionally) that the `changed-resource` test give the two buffers distinct expected outputs. My first fix varied the *global scalar addend* (10 vs 20) to make the outputs differ. codex CODE_REVIEW correctly flagged this as a **must-fix that silently weakened the test**: the test's purpose is to prove that changing the bound *resource* changes the interned packet, but if the scalar also changes, a defect that ignored the resource-address change would *still* produce a distinct packet (via the scalar) and the test would pass anyway.

Rule: when a test isolates that changing field X causes an effect, hold every *other* field that also feeds the packet/key identical, and get the distinct observable output from a channel that is NOT part of X. Here the fix was: keep `globalAddend`/`globalIndex` identical, and get distinct outputs (10 vs 15) from the per-launch **entry-point argument**, which is not part of the global packet. Then a defect that reused the prior upload leaves the second buffer unwritten (0, not 15) — genuinely caught.

Also useful (slang-rhi CUDA): a plain global-uniforms compute entry point (`computeMain`) produces **2** distinct `ConstantBufferMemType::Global` packets per binding build (the root global-params packet + a default constant-buffer sub-object), not 1. So an interning-dedup test must assert *footprint invariance* (recording N identical builds doesn't grow `internedGlobalParams` beyond a measured single-build baseline), never a hard-coded `size()==1`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789483205403-test-isolation-don-t-distinguish-outputs-by-varyin.md`_
