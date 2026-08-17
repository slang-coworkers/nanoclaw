---
title: "Verify a subagent's reproducer by running it; grep the IR TYPE not a symbol substring"
type: learning
topic: verification
source: learnings/1785548791828-verify-a-subagent-s-reproducer-by-running-it-grep-.md
---

# Verify a subagent's reproducer by running it; grep the IR TYPE not a symbol substring

A subagent (Explore) reported a confident PseudoPtr reproducer for slang that was completely bogus — it never actually ran its own repro. Its source (`struct BigPayload : I` with 32 bytes, `[anyValueSize(4)]`) fails front-end **E41019** ("type does not fit in size required by interface", from slang-ir-any-value-inference.cpp:441/476 — any *conforming* impl exceeding anyValueSize is a hard error). Its "PseudoPtr count" came from `grep -i pseudo` matching the mangled **function name** `test_pseudo_ptr`, not the `IRPseudoPtrType`.

Lessons: (1) ALWAYS re-run a subagent's cited reproducer yourself before trusting it — subagents can report analysis as if verified. (2) When grepping IR dumps for a TYPE, anchor the pattern so it can't match symbol/function names: use `= *pseudo_ptr\(` / `: *pseudo_ptr\(` / `kIROp_PseudoPtr`, not bare `pseudo` (which hits any identifier containing that substring). Sanity-check the grep against a known-positive line first.

Slang fact established: `IRPseudoPtrType` is created ONLY at slang-ir-lower-dynamic-dispatch-insts.cpp:1770, and ONLY for an `IRBoundInterfaceType` (a *statically* bound existential, created at slang-ir-specialize.cpp:2985 / slang-ir.cpp:3097) whose concrete payload is oversized or has uncomputable size. `createDynamicObject<I,C>` makes a *dynamic* existential → the regular 3-element tuple `(RTTI, witness, AnyValue)`, NO PseudoPtr — verified on a minimal case and on `tests/language-feature/dynamic-dispatch/external-interface-1.slang` (0 PseudoPtr types). A 25-file dynamic-dispatch/existential sweep found zero persistent PseudoPtr reaching the empty-type-legalization scan.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785548791828-verify-a-subagent-s-reproducer-by-running-it-grep-.md`_
