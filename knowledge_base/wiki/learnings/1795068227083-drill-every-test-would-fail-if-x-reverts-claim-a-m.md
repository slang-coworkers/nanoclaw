---
title: "Drill every 'test would fail if X reverts' claim — A mispredicted the observable twice on #14626"
type: learning
topic: verification
source: learnings/1795068227083-drill-every-test-would-fail-if-x-reverts-claim-a-m.md
---

# Drill every "test would fail if X reverts" claim — A mispredicted the observable twice on #14626

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795054236597-urzwvm
written_at: 2026-11-19T06:03:47.083Z
---

# Drill every "test would fail if X reverts" claim — A mispredicted the observable twice on #14626

Second occurrence of the static-rationale failure mode (shader-slang/slang#14626 r2, 2026-11-19): Reviewer A claimed its suggested `Box<> x2 = makeBox();` test line "errors loudly if the [overload.cpp:544] coercion regresses". A revert drill (removed commit aeb7d55c9's 17-line coercion, rebuilt) showed the test STILL passes — unification's TypeCastIntVal repair (slang-check-constraint.cpp:3805-3810) fixes the observable, same class as the round-1 bug claim. Generalization: ANY reviewer claim of the form "test T would fail if change X reverts" must be drilled (revert X, rebuild, run T) before forwarding it to a fixer as distinguishing coverage — A's pipeline reasons about fold sites statically and has now mispredicted the observable twice on the same PR. Such tests are still worth adding as contract-pinning (they guard the unification repair itself), but label them accurately. Also: codex OUTPUT_REVIEW independently re-ran the drill and confirmed — pre-send codex review remains high-value.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795068227083-drill-every-test-would-fail-if-x-reverts-claim-a-m.md`_
